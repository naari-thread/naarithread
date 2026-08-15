import type { ProductSearchEntry } from "@/lib/firebase/product-search-index";

type RankedSearchEntry = {
  product: ProductSearchEntry;
  score: number;
};

export function normalizeProductSearchText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function getProductSearchScore(
  product: ProductSearchEntry,
  normalizedQuery: string
): number {
  const name = normalizeProductSearchText(product.name);
  const category = normalizeProductSearchText(product.category);
  const subCategory = normalizeProductSearchText(product.subCategory);
  const searchableText = `${name} ${category} ${subCategory}`;
  const terms = normalizedQuery.split(" ").filter(Boolean);

  if (!terms.every((term) => searchableText.includes(term))) return -1;

  let score = 0;
  if (name === normalizedQuery) score += 140;
  else if (name.startsWith(normalizedQuery)) score += 110;
  else if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) score += 85;
  else if (name.includes(normalizedQuery)) score += 70;

  if (subCategory.startsWith(normalizedQuery)) score += 28;
  else if (subCategory.includes(normalizedQuery)) score += 20;

  if (category.startsWith(normalizedQuery)) score += 18;
  else if (category.includes(normalizedQuery)) score += 12;

  score += terms.reduce((total, term) => {
    if (name.split(" ").some((word) => word.startsWith(term))) return total + 12;
    if (name.includes(term)) return total + 7;
    return total + 2;
  }, 0);

  return score;
}

export function rankProductSearchEntries(
  products: ProductSearchEntry[],
  query: string,
  limit?: number
): ProductSearchEntry[] {
  const normalizedQuery = normalizeProductSearchText(query);
  if (!normalizedQuery) return products;

  const ranked: RankedSearchEntry[] = [];
  for (const product of products) {
    const score = getProductSearchScore(product, normalizedQuery);
    if (score >= 0) ranked.push({ product, score });
  }

  const matches = ranked
    .sort((first, second) => {
      if (first.score !== second.score) return second.score - first.score;
      return first.product.name.localeCompare(second.product.name, undefined, {
        sensitivity: "base",
      });
    })
    .map(({ product }) => product);

  return typeof limit === "number" ? matches.slice(0, Math.max(0, limit)) : matches;
}
