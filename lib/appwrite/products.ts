import { Client, Databases, Query, type Models } from "node-appwrite";
import { unstable_cache } from "next/cache";

import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { normalizeProductCategory, type ProductCategorySlug, type ProductSubCategorySlug } from "@/lib/product-taxonomy";
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

let resolvedDatabaseIdCache: string | null = null;
const SKU_COLLECTION_ID = "sku";
const REVIEWS_COLLECTION_CANDIDATES = ["reviews", "review"] as const;
const MAX_PRODUCT_READ_LIMIT = 500;

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

  return {
    id: String(document.$id ?? ""),
    slug: ensureSlug(String(document.slug ?? name), String(document.$id ?? "product")),
    name,
    description,
    sku: String(document.sku ?? document.$id ?? ""),
    category: normalizedCategory.category,
    subCategory: normalizedCategory.subCategory,
    categoryValue: categoryRaw.trim() || normalizedCategory.category,
    subCategoryValue: subCategoryRaw.trim() || normalizedCategory.subCategory,
    mainImageUrl: String(document.mainImageUrl ?? document.mainImage ?? ""),
    otherImageUrls: toStringArray(document.otherImageUrls ?? document.altImages),
    discountPrice: toNumber(document.discountPrice),
    originalPrice: toNumber(document.originalPrice),
    stockQty: toStockQuantity(document),
    rating: Math.min(
      5,
      Math.max(0, toNumber(document.rating ?? document.aggRating ?? document.averageRating ?? document.avgRating))
    ),
    ratingCount: Math.max(0, Math.trunc(toNumber(document.ratingCount ?? document.reviewCount ?? document.reviewsCount))),
    colorOptions: toStringArray(document.colorOptions),
    sizeOptions:
      Array.isArray(document.sizeOptions)
        ? toStringArray(document.sizeOptions)
        : typeof document.size === "string"
          ? [document.size]
          : [],
    isActive: typeof document.isActive === "boolean" ? document.isActive : true,
    createdAt: String(document.$createdAt ?? ""),
    badge: String(document.badge ?? document.productBadge ?? "").trim(),
  };
}

function createReadClient(): Client | null {
  const endpoint = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "naarithread.firebaseapp.com";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread";

  if (!projectId) {
    return null;
  }

  return new Client().setEndpoint(endpoint).setProject(projectId);
}

function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeCode = "code" in error ? Number((error as { code?: unknown }).code) : NaN;
  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return maybeCode === 404 || maybeMessage.toLowerCase().includes("database with the requested id");
}

async function resolveDatabaseId(databases: Databases, configuredDatabaseId: string): Promise<string> {
  if (resolvedDatabaseIdCache) {
    return resolvedDatabaseIdCache;
  }

  const list = await databases.list();
  const normalizedConfigured = configuredDatabaseId.trim().toLowerCase();

  const matched = list.databases.find((database) => {
    const id = database.$id.toLowerCase();
    const name = database.name.toLowerCase();
    return id === normalizedConfigured || name === normalizedConfigured;
  });

  if (matched) {
    resolvedDatabaseIdCache = matched.$id;
    return matched.$id;
  }

  const byDefaultName = list.databases.find((database) => database.name.toLowerCase() === "naarithread");
  if (byDefaultName) {
    resolvedDatabaseIdCache = byDefaultName.$id;
    return byDefaultName.$id;
  }

  return configuredDatabaseId;
}

async function resolveContext(): Promise<{
  databases: Databases;
  databaseId: string;
  collectionId: string;
} | null> {
  const client = createReadClient();
  if (!client) {
    return null;
  }

  const databases = new Databases(client);
  const configuredDatabaseId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread";

  let databaseId = configuredDatabaseId;
  try {
    databaseId = await resolveDatabaseId(databases, configuredDatabaseId);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  return {
    databases,
    databaseId,
    collectionId: SKU_COLLECTION_ID,
  };
}

export function sortProductsByStockAvailability(products: ProductRecord[]): ProductRecord[] {
  return [...products].sort((first, second) => {
    const firstOutOfStock = first.stockQty <= 0;
    const secondOutOfStock = second.stockQty <= 0;

    if (firstOutOfStock === secondOutOfStock) {
      return toDateMs(second.createdAt) - toDateMs(first.createdAt);
    }

    return firstOutOfStock ? 1 : -1;
  });
}

type ReviewAggregateDocument = Models.Document & {
  productId?: unknown;
  productID?: unknown;
  sku?: unknown;
  productSku?: unknown;
  product?: unknown;
  slug?: unknown;
  rating?: unknown;
  isApproved?: unknown;
};

function getReviewProductReferences(document: ReviewAggregateDocument): string[] {
  return [
    document.productId,
    document.productID,
    document.sku,
    document.productSku,
    document.product,
    document.slug,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

async function applyApprovedReviewAggregates(
  context: NonNullable<Awaited<ReturnType<typeof resolveContext>>>,
  products: ProductRecord[],
): Promise<ProductRecord[]> {
  if (products.length === 0) {
    return products;
  }

  let reviewDocuments: ReviewAggregateDocument[] = [];

  for (const collectionId of REVIEWS_COLLECTION_CANDIDATES) {
    try {
      const response = await context.databases.listDocuments<ReviewAggregateDocument>(
        context.databaseId,
        collectionId,
        [Query.limit(MAX_PRODUCT_READ_LIMIT)],
      );
      reviewDocuments = response.documents;
      break;
    } catch {
      // Some migrated projects used the singular collection name.
    }
  }

  const productIdByReference = new Map<string, string>();
  for (const product of products) {
    for (const reference of [product.id, product.sku, product.slug]) {
      const normalizedReference = reference.trim();
      if (normalizedReference) {
        productIdByReference.set(normalizedReference, product.id);
      }
    }
  }

  const aggregates = new Map<string, { count: number; total: number }>();
  for (const review of reviewDocuments) {
    if (review.isApproved === false) {
      continue;
    }

    const productId = getReviewProductReferences(review)
      .map((reference) => productIdByReference.get(reference))
      .find((reference): reference is string => Boolean(reference));
    if (!productId) {
      continue;
    }

    const rating = Math.max(1, Math.min(5, toNumber(review.rating, 5)));
    const aggregate = aggregates.get(productId) ?? { count: 0, total: 0 };
    aggregate.count += 1;
    aggregate.total += rating;
    aggregates.set(productId, aggregate);
  }

  return products.map((product) => {
    const aggregate = aggregates.get(product.id);
    return {
      ...product,
      rating: aggregate ? aggregate.total / aggregate.count : 0,
      ratingCount: aggregate?.count ?? 0,
    };
  });
}

async function listProductsFromCollectionUncached(): Promise<ProductRecord[]> {
  const context = await resolveContext();
  if (!context) {
    return [] as ProductRecord[];
  }

  const queries: string[] = [Query.limit(MAX_PRODUCT_READ_LIMIT)];

  const response = await context.databases.listDocuments(context.databaseId, context.collectionId, queries);

  const products = response.documents.map((document) =>
    toProductRecord(document as Record<string, unknown>),
  );
  const productsWithReviewAggregates = await applyApprovedReviewAggregates(context, products);

  return sortProductsByStockAvailability(productsWithReviewAggregates);
}

const listProductsFromCollectionCached = unstable_cache(
  listProductsFromCollectionUncached,
  ["products-catalog-v4"],
  {
    revalidate: 900,
    tags: [PRODUCT_CATALOG_CACHE_TAG],
  },
);

export async function listProductsFromCollection(): Promise<ProductRecord[]> {
  return listProductsFromCollectionCached();
}

type ListProductsPageOptions = {
  limit?: number;
  offset?: number;
};

async function listProductsPageFromCollectionUncached(limit: number, offset: number): Promise<PaginatedProductsResult> {
  const context = await resolveContext();
  if (!context) {
    return {
      products: [],
      total: 0,
      hasMore: false,
      nextOffset: null,
    };
  }

  const response = await context.databases.listDocuments(context.databaseId, context.collectionId, [
    Query.limit(MAX_PRODUCT_READ_LIMIT),
  ]);

  const allProducts = response.documents.map((document) =>
    toProductRecord(document as Record<string, unknown>),
  );
  const productsWithReviewAggregates = await applyApprovedReviewAggregates(context, allProducts);
  const products = sortProductsByStockAvailability(productsWithReviewAggregates).slice(
    offset,
    offset + limit,
  );
  const nextOffset = offset + products.length;

  return {
    products,
    total: response.total,
    hasMore: nextOffset < response.total,
    nextOffset: nextOffset < response.total ? nextOffset : null,
  };
}

const listProductsPageFromCollectionCached = unstable_cache(
  listProductsPageFromCollectionUncached,
  ["products-page-v4"],
  {
    revalidate: 1800,
    tags: [PRODUCT_CATALOG_CACHE_TAG],
  },
);

export async function listProductsPageFromCollection(options: ListProductsPageOptions = {}): Promise<PaginatedProductsResult> {
  const limit = Math.min(100, Math.max(1, Math.trunc(options.limit ?? 12)));
  const offset = Math.max(0, Math.trunc(options.offset ?? 0));

  return listProductsPageFromCollectionCached(limit, offset);
}

export async function getProductsByIds(ids: string[]): Promise<ProductRecord[]> {
  if (ids.length === 0) return [];

  const context = await resolveContext();
  if (!context) return [];

  const safeIds = ids.slice(0, 100);
  const response = await context.databases.listDocuments(context.databaseId, context.collectionId, [
    Query.equal("$id", safeIds),
    Query.limit(safeIds.length),
  ]);

  return response.documents.map((doc) => toProductRecord(doc as Record<string, unknown>));
}

export async function getProductBySlug(slug: string) {
  const normalizedSlug = toSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const context = await resolveContext();
  if (!context) {
    return null;
  }

  try {
    const bySlug = await context.databases.listDocuments(context.databaseId, context.collectionId, [
      Query.equal("slug", normalizedSlug),
      Query.limit(1),
    ]);

    if (bySlug.documents[0]) {
      return toProductRecord(bySlug.documents[0] as Record<string, unknown>);
    }
  } catch {
    // slug field may not be indexed — fall through to name-based scan below
  }

  // Fallback: scan a limited recent batch rather than all 100 products
  const recent = await context.databases.listDocuments(context.databaseId, context.collectionId, [
    Query.limit(50),
    Query.orderDesc("$createdAt"),
  ]);
  const match = recent.documents.find((doc) => {
    const name = String(doc.name ?? "");
    return ensureSlug(String(doc.slug ?? name), String(doc.$id ?? "")) === normalizedSlug;
  });
  return match ? toProductRecord(match as Record<string, unknown>) : null;
}

export async function getRelatedProducts(product: ProductRecord, limit = 4) {
  const allProducts = await listProductsFromCollection();
  const available = allProducts.filter((item) => item.id !== product.id && item.isActive);

  const selected: ProductRecord[] = [];
  const seen = new Set<string>();

  function takeMatching(predicate: (item: ProductRecord) => boolean, maxToTake: number) {
    if (maxToTake <= 0) {
      return;
    }

    const matches = available.filter((item) => predicate(item) && !seen.has(item.id)).slice(0, maxToTake);
    for (const item of matches) {
      seen.add(item.id);
      selected.push(item);
    }
  }

  takeMatching((item) => item.subCategory === product.subCategory, limit);
  takeMatching((item) => item.category === product.category, limit - selected.length);

  if (selected.length < limit) {
    const randomPool = available.filter((item) => !seen.has(item.id)).sort(() => Math.random() - 0.5);
    for (const item of randomPool) {
      seen.add(item.id);
      selected.push(item);
      if (selected.length >= limit) {
        break;
      }
    }
  }

  return selected.slice(0, limit);
}
