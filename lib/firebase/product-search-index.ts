import { unstable_cache } from "next/cache";

import { PRODUCT_SEARCH_INDEX_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import {
  isProductCategorySlug,
  isProductSubCategorySlug,
  type ProductCategorySlug,
  type ProductSubCategorySlug,
} from "@/lib/product-taxonomy";

const SEARCH_INDEX_DOCUMENT_ID = "productSearchIndex";

export type ProductSearchEntry = {
  id: string;
  name: string;
  slug: string;
  category: ProductCategorySlug;
  subCategory: ProductSubCategorySlug;
};

type ProductSearchIndexDocument = {
  version: number;
  updatedAt: string;
  products: ProductSearchEntry[];
};

function normalizeEntry(value: unknown): ProductSearchEntry | null {
  if (!value || typeof value !== "object") return null;
  const record = Object.fromEntries(Object.entries(value));
  const id = String(record.id ?? "").trim();
  const name = String(record.name ?? "").trim();
  const slug = String(record.slug ?? "").trim();
  const category = String(record.category ?? "").trim();
  const subCategory = String(record.subCategory ?? "").trim();
  if (!id || !name || !slug || !isProductCategorySlug(category) || !isProductSubCategorySlug(subCategory)) {
    return null;
  }
  const entry: ProductSearchEntry = { id, name, slug, category, subCategory };
  return Object.values(entry).every(Boolean) ? entry : null;
}

function normalizeEntries(value: unknown): ProductSearchEntry[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, ProductSearchEntry>();
  for (const candidate of value) {
    const entry = normalizeEntry(candidate);
    if (entry) byId.set(entry.id, entry);
  }
  return [...byId.values()].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: "base" })
  );
}

function searchIndexRef() {
  return getAdminDb()
    .collection(FIRESTORE_COLLECTIONS.catalogMetadata)
    .doc(SEARCH_INDEX_DOCUMENT_ID);
}

async function readProductSearchIndexUncached(): Promise<ProductSearchEntry[]> {
  const snapshot = await searchIndexRef().get();
  return snapshot.exists ? normalizeEntries(snapshot.data()?.products) : [];
}

const readProductSearchIndexCached = unstable_cache(
  readProductSearchIndexUncached,
  ["product-search-index-v2"],
  { revalidate: 3600, tags: [PRODUCT_SEARCH_INDEX_CACHE_TAG] }
);

export async function readProductSearchIndex(): Promise<ProductSearchEntry[]> {
  return readProductSearchIndexCached();
}

export async function writeProductSearchIndex(entries: ProductSearchEntry[]): Promise<void> {
  const payload: ProductSearchIndexDocument = {
    version: 1,
    updatedAt: new Date().toISOString(),
    products: normalizeEntries(entries),
  };
  await searchIndexRef().set(payload);
}

export async function upsertProductSearchEntry(entry: ProductSearchEntry): Promise<void> {
  const normalized = normalizeEntry(entry);
  if (!normalized) throw new Error("Cannot index an incomplete product.");

  const reference = searchIndexRef();
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const products = normalizeEntries(snapshot.data()?.products);
    const next = products.filter((product) => product.id !== normalized.id);
    next.push(normalized);
    const payload: ProductSearchIndexDocument = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products: normalizeEntries(next),
    };
    transaction.set(reference, payload);
  });
}

export async function removeProductSearchEntry(productId: string): Promise<void> {
  const normalizedId = productId.trim();
  if (!normalizedId) return;
  const reference = searchIndexRef();
  await getAdminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const payload: ProductSearchIndexDocument = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products: normalizeEntries(snapshot.data()?.products).filter(
        (product) => product.id !== normalizedId
      ),
    };
    transaction.set(reference, payload);
  });
}
