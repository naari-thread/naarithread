import type { ProductRecord } from "@/lib/appwrite/products";

const PRODUCT_SNAPSHOT_STORAGE_KEY = "nt-product-snapshot-v1";

function normalizeProducts(value: unknown): ProductRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ProductRecord => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const maybe = item as Partial<ProductRecord>;
    return (
      typeof maybe.id === "string" &&
      typeof maybe.name === "string" &&
      typeof maybe.slug === "string" &&
      typeof maybe.category === "string" &&
      typeof maybe.subCategory === "string"
    );
  });
}

export function readCachedProductSnapshot(): ProductRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(PRODUCT_SNAPSHOT_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as { products?: unknown };
    return normalizeProducts(parsed.products);
  } catch {
    return [];
  }
}

export function writeCachedProductSnapshot(products: ProductRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeProducts(products);

  try {
    window.localStorage.setItem(
      PRODUCT_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        updatedAt: Date.now(),
        products: normalized,
      })
    );
  } catch {
    return;
  }
}

export async function fetchProductsByIds(ids: string[], signal?: AbortSignal): Promise<ProductRecord[]> {
  if (typeof window === "undefined" || ids.length === 0) {
    return [];
  }

  try {
    const response = await fetch(`/api/catalog/products?ids=${ids.join(",")}`, {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { products?: unknown };
    return normalizeProducts(payload.products);
  } catch {
    return [];
  }
}

export async function fetchCatalogProductsFromApi(signal?: AbortSignal): Promise<ProductRecord[]> {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const response = await fetch("/api/catalog/products", {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as { products?: unknown };
    return normalizeProducts(payload.products);
  } catch {
    return [];
  }
}

function createProductFingerprint(product: ProductRecord) {
  return [
    product.id,
    product.createdAt,
    product.name,
    product.discountPrice,
    product.originalPrice,
    product.stockQty,
    product.mainImageUrl,
  ].join("::");
}

export function areProductsEquivalent(next: ProductRecord[], current: ProductRecord[]) {
  if (next.length !== current.length) {
    return false;
  }

  const nextFingerprints = next
    .map((product) => createProductFingerprint(product))
    .sort();
  const currentFingerprints = current
    .map((product) => createProductFingerprint(product))
    .sort();

  return nextFingerprints.every((value, index) => value === currentFingerprints[index]);
}
