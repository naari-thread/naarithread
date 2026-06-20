type TimestampLike = {
  toDate: () => Date;
};

function isTimestampLike(value: unknown): value is TimestampLike {
  return typeof value === "object" && value !== null && "toDate" in value && typeof (value as TimestampLike).toDate === "function";
}

export function timestampToIso(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (isTimestampLike(value)) return value.toDate().toISOString();
  return String(value);
}

export function withDocumentMeta<T extends Record<string, unknown>>(id: string, data: T): T & {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
} {
  const createdAt = timestampToIso(data.createdAt);
  const updatedAt = timestampToIso(data.updatedAt) || createdAt;
  return {
    ...data,
    $id: id,
    $createdAt: createdAt,
    $updatedAt: updatedAt,
  };
}

export function sanitizeWritePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("$") || typeof value === "undefined") continue;
    clean[key] = value;
  }
  return clean;
}
