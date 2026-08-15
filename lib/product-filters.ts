import type { ProductRecord } from "@/lib/appwrite/products";

export function normalizeFilterValue(value: string): string {
  return value.trim().toLowerCase();
}

export function isOnSale(product: ProductRecord): boolean {
  return (
    product.originalPrice > 0 &&
    product.discountPrice > 0 &&
    product.discountPrice < product.originalPrice
  );
}

const NEW_ARRIVAL_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export function isNewArrival(product: ProductRecord, referenceMs: number = Date.now()): boolean {
  if (!product.createdAt) {
    return false;
  }

  const createdAtMs = new Date(product.createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const ageMs = referenceMs - createdAtMs;
  return ageMs >= 0 && ageMs <= NEW_ARRIVAL_WINDOW_MS;
}

export function matchesSize(product: ProductRecord, size: string): boolean {
  const normalized = normalizeFilterValue(size);
  return product.sizeOptions.some((option) => normalizeFilterValue(option) === normalized);
}

export function matchesColor(product: ProductRecord, color: string): boolean {
  const normalized = normalizeFilterValue(color);
  return product.colorOptions.some((option) => normalizeFilterValue(option) === normalized);
}

export function getSellingPrice(product: ProductRecord): number {
  return product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
}

export function matchesPriceRange(product: ProductRecord, min: number, max: number): boolean {
  const sellingPrice = getSellingPrice(product);
  return sellingPrice >= min && sellingPrice <= max;
}

export function matchesSearch(product: ProductRecord, search: string): boolean {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const searchableText = [
    product.name,
    product.sku,
    product.category,
    product.subCategory,
    product.categoryValue,
    product.subCategoryValue,
  ].join(" ").toLowerCase();
  return terms.every((term) => searchableText.includes(term));
}

export function compareProductStockPlacement(first: ProductRecord, second: ProductRecord): number {
  const firstOutOfStock = first.stockQty <= 0;
  const secondOutOfStock = second.stockQty <= 0;

  if (firstOutOfStock === secondOutOfStock) {
    return 0;
  }

  return firstOutOfStock ? 1 : -1;
}
