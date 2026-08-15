import type {
  MeasurementKey,
  SizeChartDocument,
  SizeChartSnapshot,
} from "@/lib/product-merchandising";

const STANDARD_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
const STANDARD_BRAND_SIZES = ["32", "34", "36", "38", "40", "42"] as const;
type PresetMeasurements = Partial<Record<MeasurementKey, readonly number[]>>;

function createStandardRows(
  columns: MeasurementKey[],
  values: PresetMeasurements
): SizeChartSnapshot["rows"] {
  return STANDARD_SIZES.map((size, index) => ({
    size,
    brandSize: STANDARD_BRAND_SIZES[index] ?? "",
    measurements: columns.reduce<Partial<Record<MeasurementKey, number | null>>>(
      (measurements, column) => ({
        ...measurements,
        [column]: values[column]?.[index] ?? null,
      }),
      {}
    ),
  }));
}

function preset(
  id: string,
  name: string,
  garmentType: string,
  columns: MeasurementKey[],
  values: PresetMeasurements
): SizeChartSnapshot {
  return {
    id,
    name,
    garmentType,
    unit: "in",
    columns,
    rows: createStandardRows(columns, values),
    isPreset: true,
  };
}

export const SIZE_CHART_PRESETS: SizeChartSnapshot[] = [
  preset("preset-tops-kurtis", "Tops, Kurtis & Blouses", "upper", [
    "bust", "waist", "acrossShoulder",
  ], {
    bust: [32, 34, 36, 38, 40, 42],
    waist: [26, 28, 30, 32, 34, 36],
    acrossShoulder: [13.5, 14, 14.5, 15, 15.5, 16],
  }),
  preset("preset-dresses-anarkalis", "Dresses & Anarkalis", "full-body", [
    "bust", "waist", "hip",
  ], {
    bust: [32, 34, 36, 38, 40, 42],
    waist: [26, 28, 30, 32, 34, 36],
    hip: [34, 36, 38, 40, 42, 44],
  }),
  preset("preset-trousers-jeans", "Trousers & Jeans", "bottom", [
    "waist", "hip", "inseam",
  ], {
    waist: [26, 28, 30, 32, 34, 36],
    hip: [34, 36, 38, 40, 42, 44],
    inseam: [28, 28, 28.5, 28.5, 29, 29],
  }),
  preset("preset-skirts-lehengas", "Skirts & Lehengas", "bottom", [
    "waist", "hip", "garmentLength",
  ], {
    waist: [26, 28, 30, 32, 34, 36],
    hip: [34, 36, 38, 40, 42, 44],
    garmentLength: [39, 39.5, 40, 40.5, 41, 41.5],
  }),
];

/** Applies Firestore edits and soft-deletes to the built-in preset library. */
export function mergeSizeChartLibrary(
  documents: SizeChartDocument[]
): SizeChartSnapshot[] {
  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const presetIds = new Set(SIZE_CHART_PRESETS.map((presetChart) => presetChart.id));
  const mergedPresets = SIZE_CHART_PRESETS.flatMap((presetChart) => {
    const override = documentsById.get(presetChart.id);
    if (override?.isActive === false) return [];
    return [override ?? presetChart];
  });
  const customCharts = documents.filter(
    (document) => document.isActive && !presetIds.has(document.id)
  );
  return [...mergedPresets, ...customCharts];
}
