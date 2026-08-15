import { unstable_cache } from "next/cache";

import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import { timestampToIso } from "@/lib/firebase/document";
import { readProductSearchIndex } from "@/lib/firebase/product-search-index";
import { compareProductStockPlacement } from "@/lib/product-filters";
import {
  getTotalSizeStock,
  parseColorMedia,
  parseSizeChartSnapshot,
  parseSizeInventory,
  type ProductColorMedia,
  type SizeChartSnapshot,
  type SizeInventoryItem,
} from "@/lib/product-merchandising";
import {
  normalizeProductCategory,
  type ProductCategorySlug,
  type ProductSubCategorySlug,
} from "@/lib/product-taxonomy";
import { ensureSlug, toSlug } from "@/lib/slug";

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sku: string;
  category: ProductCategorySlug;
  subCategory: ProductSubCategorySlug;
  categoryValue: string;
  subCategoryValue: string;
  mainImageUrl: string;
  otherImageUrls: string[];
  discountPrice: number;
  originalPrice: number;
  stockQty: number;
  rating: number;
  ratingCount: number;
  colorOptions: string[];
  sizeOptions: string[];
  sizeInventory: SizeInventoryItem[];
  colorMedia: ProductColorMedia[];
  sizeChartId: string;
  sizeChart: SizeChartSnapshot | null;
  isActive: boolean;
  createdAt: string;
  badge: string;
};

export type PaginatedProductsResult = {
  products: ProductRecord[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type ListProductsPageOptions = {
  limit?: number;
  offset?: number;
  category?: ProductCategorySlug;
  subCategory?: ProductSubCategorySlug;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function hasNumericValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 && Number.isFinite(Number(trimmed));
  }

  return false;
}

function toStockQuantity(document: Record<string, unknown>): number {
  if (hasNumericValue(document.stockQty)) {
    return Math.max(0, Math.trunc(toNumber(document.stockQty)));
  }

  return typeof document.inStock === "boolean" && document.inStock ? 10 : 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toDateMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toProductRecord(document: Record<string, unknown>): ProductRecord {
  const name = String(document.name ?? "Untitled Product");
  const description = String(document.description ?? "");
  const categoryRaw = String(document.category ?? "");
  const subCategoryRaw = String(document.subCategory ?? document.subcategory ?? "");
  const normalizedCategory = normalizeProductCategory({
    categoryRaw,
    subCategoryRaw,
    name,
    description,
  });
  const sizeInventory = parseSizeInventory(document.sizeInventory);
  const inventoryStock = getTotalSizeStock(sizeInventory);
  const legacySizeOptions = Array.isArray(document.sizeOptions)
    ? toStringArray(document.sizeOptions)
    : typeof document.size === "string"
      ? [document.size]
      : [];

  return {
    id: String(document.$id ?? document.id ?? ""),
    slug: ensureSlug(String(document.slug ?? name), String(document.$id ?? document.id ?? "product")),
    name,
    description,
    sku: String(document.sku ?? document.$id ?? document.id ?? ""),
    category: normalizedCategory.category,
    subCategory: normalizedCategory.subCategory,
    categoryValue: categoryRaw.trim() || normalizedCategory.category,
    subCategoryValue: subCategoryRaw.trim() || normalizedCategory.subCategory,
    mainImageUrl: String(document.mainImageUrl ?? document.mainImage ?? ""),
    otherImageUrls: toStringArray(document.otherImageUrls ?? document.altImages),
    discountPrice: toNumber(document.discountPrice),
    originalPrice: toNumber(document.originalPrice),
    stockQty: sizeInventory.length > 0 ? inventoryStock : toStockQuantity(document),
    rating: Math.min(
      5,
      Math.max(0, toNumber(document.rating ?? document.aggRating ?? document.averageRating ?? document.avgRating))
    ),
    ratingCount: Math.max(
      0,
      Math.trunc(toNumber(document.ratingCount ?? document.reviewCount ?? document.reviewsCount))
    ),
    colorOptions: toStringArray(document.colorOptions),
    sizeOptions: sizeInventory.length > 0
      ? sizeInventory.map((item) => item.size)
      : legacySizeOptions,
    sizeInventory,
    colorMedia: parseColorMedia(document.colorMedia),
    sizeChartId: String(document.sizeChartId ?? "").trim(),
    sizeChart: parseSizeChartSnapshot(document.sizeChart),
    isActive: typeof document.isActive === "boolean" ? document.isActive : true,
    createdAt: timestampToIso(document.$createdAt ?? document.createdAt),
    badge: String(document.badge ?? document.productBadge ?? "").trim(),
  };
}

async function listProductsFromCollectionUncached(): Promise<ProductRecord[]> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(FIRESTORE_COLLECTIONS.products).get();

    if (snapshot.empty) {
      return [];
    }

    const seenIds = new Set<string>();
    const products: ProductRecord[] = [];

    for (const doc of snapshot.docs) {
      if (seenIds.has(doc.id)) {
        continue;
      }
      seenIds.add(doc.id);

      const data = doc.data();
      const record = toProductRecord({
        ...data,
        $id: doc.id,
        $createdAt: data.createdAt,
      });

      // Strictly exclude inactive products from the public catalog
      if (record.isActive !== false) {
        products.push(record);
      }
    }

    // Sort in-stock products first, followed by newest additions
    return products.sort((a, b) => {
      const stockCompare = compareProductStockPlacement(a, b);
      if (stockCompare !== 0) {
        return stockCompare;
      }
      return toDateMs(b.createdAt) - toDateMs(a.createdAt);
    });
  } catch (error) {
    console.error("[catalog] Failed to read products from Firestore:", error);
    throw error;
  }
}

const listProductsFromCollectionCached = unstable_cache(
  listProductsFromCollectionUncached,
  ["products-catalog-v6"],
  {
    revalidate: 3600,
    tags: [PRODUCT_CATALOG_CACHE_TAG],
  }
);

/**
 * Returns all active products from the tagged Next.js catalog cache.
 * In-memory response with 0 Firestore reads on cache hit.
 */
export async function listProductsFromCollection(): Promise<ProductRecord[]> {
  return listProductsFromCollectionCached();
}

/**
 * Reads only the requested page of full product documents. The single lightweight
 * search-index document supplies IDs and taxonomy without reading the whole catalog.
 */
export async function listProductsPageFromCollection(
  options: ListProductsPageOptions = {}
): Promise<PaginatedProductsResult> {
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 12)));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));

  const index = await readProductSearchIndex();
  const matchingEntries = index.filter((entry) =>
    (!options.category || entry.category === options.category)
    && (!options.subCategory || entry.subCategory === options.subCategory)
  );
  const pageEntries = matchingEntries.slice(offset, offset + limit);
  const db = getAdminDb();
  const snapshots = pageEntries.length > 0
    ? await db.getAll(...pageEntries.map((entry) => db.collection(FIRESTORE_COLLECTIONS.products).doc(entry.id)))
    : [];
  const products = snapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const data = snapshot.data() ?? {};
    const product = toProductRecord({ ...data, $id: snapshot.id, $createdAt: data.createdAt });
    return product.isActive ? [product] : [];
  });
  const total = matchingEntries.length;
  const nextOffset = offset + pageEntries.length;

  return {
    products,
    total,
    hasMore: nextOffset < total,
    nextOffset: nextOffset < total ? nextOffset : null,
  };
}

/**
 * Resolves only the requested product documents. Cart and checkout never read the full catalog.
 */
export async function getProductsByIds(ids: string[]): Promise<ProductRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, 100);
  if (uniqueIds.length === 0) {
    return [];
  }

  const db = getAdminDb();
  const snapshots = await db.getAll(
    ...uniqueIds.map((id) => db.collection(FIRESTORE_COLLECTIONS.products).doc(id))
  );
  return snapshots.flatMap((snapshot) => {
    if (!snapshot.exists) return [];
    const data = snapshot.data() ?? {};
    const product = toProductRecord({ ...data, $id: snapshot.id, $createdAt: data.createdAt });
    return product.isActive ? [product] : [];
  });
}

/**
 * Resolves a product by slug, checking the cached catalog first.
 */
export async function getProductBySlug(slug: string): Promise<ProductRecord | null> {
  const normalizedSlug = toSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const index = await readProductSearchIndex();
  const entry = index.find(
    (product) => toSlug(product.slug) === normalizedSlug || toSlug(product.name) === normalizedSlug
  );
  if (!entry) return null;
  return (await getProductsByIds([entry.id]))[0] ?? null;
}

/**
 * Returns related products by matching subcategory, category, or random pool from cached catalog.
 */
export async function getRelatedProducts(product: ProductRecord, limit = 4): Promise<ProductRecord[]> {
  const index = (await readProductSearchIndex()).filter((item) => item.id !== product.id);
  const selectedIds: string[] = [];
  const seen = new Set<string>();

  function takeMatching(predicate: (item: (typeof index)[number]) => boolean, maxToTake: number): void {
    if (maxToTake <= 0) {
      return;
    }

    const matches = index.filter((item) => predicate(item) && !seen.has(item.id)).slice(0, maxToTake);
    for (const item of matches) {
      seen.add(item.id);
      selectedIds.push(item.id);
    }
  }

  takeMatching((item) => item.subCategory === product.subCategory, limit);
  takeMatching((item) => item.category === product.category, limit - selectedIds.length);

  if (selectedIds.length < limit) {
    const remainingPool = index.filter((item) => !seen.has(item.id));
    for (const item of remainingPool) {
      seen.add(item.id);
      selectedIds.push(item.id);
      if (selectedIds.length >= limit) {
        break;
      }
    }
  }

  return getProductsByIds(selectedIds.slice(0, limit));
}
