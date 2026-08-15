import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { SIZE_CHARTS_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import {
  sizeChartSnapshotSchema,
  type SizeChartDocument,
  type SizeChartSnapshot,
} from "@/lib/product-merchandising";
import { SIZE_CHART_PRESETS } from "@/lib/size-chart-presets";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ chartId: string }> };

function toDocument(
  chart: SizeChartSnapshot,
  createdAt: string,
  isActive: boolean
): SizeChartDocument {
  return {
    ...chart,
    isActive,
    createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export async function PATCH(
  request: Request,
  context: RouteContext
): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chartId } = await context.params;
  const normalizedId = chartId.trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "Missing chart ID." }, { status: 400 });
  }

  try {
    const result = sizeChartSnapshotSchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid size chart.", issues: result.error.flatten() },
        { status: 400 }
      );
    }

    const reference = getAdminDb()
      .collection(FIRESTORE_COLLECTIONS.sizeCharts)
      .doc(normalizedId);
    const existing = await reference.get();
    const existingCreatedAt = existing.data()?.createdAt;
    const createdAt = typeof existingCreatedAt === "string"
      ? existingCreatedAt
      : new Date().toISOString();
    const chart = toDocument(
      { ...result.data, id: normalizedId },
      createdAt,
      true
    );

    await reference.set(chart);
    revalidateTag(SIZE_CHARTS_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ chart });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update size chart.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext
): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { chartId } = await context.params;
  const normalizedId = chartId.trim();
  if (!normalizedId) {
    return NextResponse.json({ error: "Missing chart ID." }, { status: 400 });
  }

  try {
    const reference = getAdminDb()
      .collection(FIRESTORE_COLLECTIONS.sizeCharts)
      .doc(normalizedId);
    const existing = await reference.get();
    const parsedExisting = sizeChartSnapshotSchema.safeParse({
      id: normalizedId,
      ...existing.data(),
    });
    const fallback = SIZE_CHART_PRESETS.find((chart) => chart.id === normalizedId);
    const chart = parsedExisting.success ? parsedExisting.data : fallback;

    if (!chart) {
      return NextResponse.json({ error: "Size chart not found." }, { status: 404 });
    }

    const existingCreatedAt = existing.data()?.createdAt;
    const createdAt = typeof existingCreatedAt === "string"
      ? existingCreatedAt
      : new Date().toISOString();
    await reference.set(toDocument(chart, createdAt, false));
    revalidateTag(SIZE_CHARTS_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete size chart.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
