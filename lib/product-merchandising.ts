import { z } from "zod";

export const MEASUREMENT_KEYS = [
  "bust",
  "underbust",
  "waist",
  "highHip",
  "hip",
  "acrossShoulder",
  "frontLength",
  "backLength",
  "garmentLength",
  "sleeveLength",
  "armhole",
  "bicep",
  "wrist",
  "neck",
  "frontRise",
  "backRise",
  "thigh",
  "knee",
  "inseam",
  "outseam",
  "legOpening",
] as const;

export type MeasurementKey = (typeof MEASUREMENT_KEYS)[number];

export const MEASUREMENT_DEFINITIONS: ReadonlyArray<{
  key: MeasurementKey;
  label: string;
  group: "upper" | "lower" | "length";
  guide: string;
}> = [
  { key: "bust", label: "Bust", group: "upper", guide: "Measure around the fullest part of the bust." },
  { key: "underbust", label: "Underbust", group: "upper", guide: "Measure directly below the bust." },
  { key: "waist", label: "Waist", group: "upper", guide: "Measure around the natural waistline." },
  { key: "highHip", label: "High Hip", group: "lower", guide: "Measure around the upper hip, below the waist." },
  { key: "hip", label: "Hip", group: "lower", guide: "Measure around the fullest part of the hips." },
  { key: "acrossShoulder", label: "Across Shoulder", group: "upper", guide: "Measure shoulder point to shoulder point across the back." },
  { key: "frontLength", label: "Front Length", group: "length", guide: "Measure from the high shoulder point down the front." },
  { key: "backLength", label: "Back Length", group: "length", guide: "Measure from the nape down the centre back." },
  { key: "garmentLength", label: "Garment Length", group: "length", guide: "Measure from the high shoulder or waist to the garment hem." },
  { key: "sleeveLength", label: "Sleeve Length", group: "upper", guide: "Measure from the shoulder point to the sleeve hem." },
  { key: "armhole", label: "Armhole", group: "upper", guide: "Measure around the armhole opening." },
  { key: "bicep", label: "Bicep", group: "upper", guide: "Measure around the fullest part of the upper arm." },
  { key: "wrist", label: "Wrist / Cuff", group: "upper", guide: "Measure around the wrist or finished cuff opening." },
  { key: "neck", label: "Neck", group: "upper", guide: "Measure around the base of the neck." },
  { key: "frontRise", label: "Front Rise", group: "lower", guide: "Measure from the front waist through the crotch seam." },
  { key: "backRise", label: "Back Rise", group: "lower", guide: "Measure from the back waist through the crotch seam." },
  { key: "thigh", label: "Thigh", group: "lower", guide: "Measure around the fullest part of the thigh." },
  { key: "knee", label: "Knee", group: "lower", guide: "Measure around the garment at knee level." },
  { key: "inseam", label: "Inseam", group: "lower", guide: "Measure from the crotch seam to the bottom hem." },
  { key: "outseam", label: "Outseam", group: "lower", guide: "Measure from the waist to the bottom hem along the outside leg." },
  { key: "legOpening", label: "Leg Opening", group: "lower", guide: "Measure across or around the finished leg opening." },
] as const;

export const measurementKeySchema = z.enum(MEASUREMENT_KEYS);

const optionalMeasurementSchema = z.number().finite().nonnegative().max(500).nullable();

export const sizeChartRowSchema = z.object({
  size: z.string().trim().min(1).max(24),
  brandSize: z.string().trim().max(24).optional().default(""),
  measurements: z.partialRecord(measurementKeySchema, optionalMeasurementSchema).default({}),
});

export const sizeChartSnapshotSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(120),
  garmentType: z.string().trim().min(1).max(80),
  unit: z.enum(["in", "cm"]),
  columns: z.array(measurementKeySchema).min(1).max(MEASUREMENT_KEYS.length),
  rows: z.array(sizeChartRowSchema).min(1).max(20),
  isPreset: z.boolean().default(false),
});

export const sizeChartDocumentSchema = sizeChartSnapshotSchema.extend({
  isActive: z.boolean().default(true),
  createdAt: z.string().optional().default(""),
  updatedAt: z.string().optional().default(""),
});

export const sizeInventoryItemSchema = z.object({
  size: z.string().trim().min(1).max(24),
  stockQty: z.number().int().nonnegative().max(999_999),
});

export const productColorMediaSchema = z.object({
  color: z.string().trim().min(1).max(60),
  imageUrls: z.array(z.string().trim().url()).max(12),
  primaryImageUrl: z.string().trim().url().optional(),
});

export const productMerchandisingSchema = z.object({
  sizeInventory: z.array(sizeInventoryItemSchema).max(30).default([]),
  colorMedia: z.array(productColorMediaSchema).max(30).default([]),
  sizeChartId: z.string().trim().max(120).default(""),
  sizeChart: sizeChartSnapshotSchema.nullable().default(null),
});

export type SizeChartRow = z.infer<typeof sizeChartRowSchema>;
export type SizeChartSnapshot = z.infer<typeof sizeChartSnapshotSchema>;
export type SizeChartDocument = z.infer<typeof sizeChartDocumentSchema>;
export type SizeInventoryItem = z.infer<typeof sizeInventoryItemSchema>;
export type ProductColorMedia = z.infer<typeof productColorMediaSchema>;

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

export function parseSizeInventory(value: unknown): SizeInventoryItem[] {
  const parsed = z.array(sizeInventoryItemSchema).safeParse(parseJson(value));
  if (!parsed.success) return [];

  const bySize = new Map<string, SizeInventoryItem>();
  for (const item of parsed.data) {
    bySize.set(item.size.toLowerCase(), item);
  }
  return [...bySize.values()];
}

export function parseColorMedia(value: unknown): ProductColorMedia[] {
  const parsed = z.array(productColorMediaSchema).safeParse(parseJson(value));
  if (!parsed.success) return [];
  return parsed.data.map((entry) => ({
    ...entry,
    imageUrls: [...new Set(entry.imageUrls)],
    primaryImageUrl: entry.primaryImageUrl && entry.imageUrls.includes(entry.primaryImageUrl)
      ? entry.primaryImageUrl
      : entry.imageUrls[0],
  }));
}

export function parseSizeChartSnapshot(value: unknown): SizeChartSnapshot | null {
  const parsed = sizeChartSnapshotSchema.safeParse(parseJson(value));
  return parsed.success ? parsed.data : null;
}

export function getTotalSizeStock(inventory: SizeInventoryItem[]): number {
  return inventory.reduce((total, item) => total + item.stockQty, 0);
}

export function getAvailableStockForSize(
  inventory: SizeInventoryItem[],
  size: string | null | undefined
): number {
  const normalizedSize = size?.trim().toLowerCase() ?? "";
  if (!normalizedSize) return 0;
  return inventory.find((item) => item.size.toLowerCase() === normalizedSize)?.stockQty ?? 0;
}

export function getImagesForColor(
  colorMedia: ProductColorMedia[],
  color: string | null | undefined
): string[] {
  const normalizedColor = color?.trim().toLowerCase() ?? "";
  if (!normalizedColor) return [];
  const mapping = colorMedia.find((entry) => entry.color.toLowerCase() === normalizedColor);
  if (!mapping) return [];
  return mapping.primaryImageUrl
    ? [mapping.primaryImageUrl, ...mapping.imageUrls.filter((url) => url !== mapping.primaryImageUrl)]
    : mapping.imageUrls;
}
