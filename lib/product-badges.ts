export const PRODUCT_BADGES = [
  { value: "limited-stock", label: "Limited Stock" },
  { value: "new-arrival", label: "New Arrival" },
  { value: "back-in-stock", label: "Back in Stock" },
] as const;

export type ProductBadgeValue = string;

export function isProductBadgeValue(value: string): value is ProductBadgeValue {
  return value.trim().length > 0;
}

export function getProductBadgeLabel(value: string): string {
  if (!value) return "";
  const hardcoded = PRODUCT_BADGES.find((badge) => badge.value === value);
  if (hardcoded) return hardcoded.label;
  // Humanise custom badge values (e.g. "festival-special" → "Festival Special")
  return value.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
