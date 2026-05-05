export function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function ensureSlug(value: string, fallback = "item") {
  const slug = toSlug(value);
  return slug || fallback;
}
