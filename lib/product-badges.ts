export const PRODUCT_BADGES = [
  { value: "limited-stock", label: "Limited Stock" },
  { value: "new-arrival", label: "New Arrival" },
  { value: "back-in-stock", label: "Back in Stock" },
] as const;

export type ProductBadgeValue = (typeof PRODUCT_BADGES)[number]["value"];

export function isProductBadgeValue(value: string): value is ProductBadgeValue {
  return PRODUCT_BADGES.some((badge) => badge.value === value);
}

export function getProductBadgeLabel(value: string): string {
  return PRODUCT_BADGES.find((badge) => badge.value === value)?.label ?? "";
}
