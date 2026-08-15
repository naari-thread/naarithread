import { unstable_cache } from "next/cache";

import { SIZE_CHARTS_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import {
  sizeChartDocumentSchema,
  type SizeChartDocument,
  type SizeChartSnapshot,
} from "@/lib/product-merchandising";

async function listSizeChartsUncached(): Promise<SizeChartDocument[]> {
  const snapshot = await getAdminDb().collection(FIRESTORE_COLLECTIONS.sizeCharts).get();
  return snapshot.docs.flatMap((document) => {
    const parsed = sizeChartDocumentSchema.safeParse({ id: document.id, ...document.data() });
    return parsed.success ? [parsed.data] : [];
  });
}

const listSizeChartsCached = unstable_cache(
  listSizeChartsUncached,
  ["size-charts-v1"],
  { revalidate: 3600, tags: [SIZE_CHARTS_CACHE_TAG] }
);

export async function listSizeCharts(): Promise<SizeChartDocument[]> {
  return (await listSizeChartsCached()).filter((chart) => chart.isActive);
}

export async function listSizeChartDocuments(): Promise<SizeChartDocument[]> {
  return listSizeChartsCached();
}

export async function getSizeChartSnapshot(chartId: string): Promise<SizeChartSnapshot | null> {
  const normalizedId = chartId.trim();
  if (!normalizedId) return null;
  const charts = await listSizeCharts();
  const chart = charts.find((item) => item.id === normalizedId);
  if (!chart) return null;
  return {
    id: chart.id,
    name: chart.name,
    garmentType: chart.garmentType,
    unit: chart.unit,
    columns: chart.columns,
    rows: chart.rows,
    isPreset: chart.isPreset,
  };
}
