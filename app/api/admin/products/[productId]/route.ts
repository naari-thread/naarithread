import { NextResponse } from "next/server";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { ensureSlug } from "@/lib/slug";

export const runtime = "nodejs";

type ProductUpdatePayload = {
  name?: string;
  description?: string;
  sku?: string;
  slug?: string;
  category?: string;
  mainImageUrl?: string;
  discountPrice?: number;
  originalPrice?: number;
  stockQty?: number;
  inStock?: boolean;
  colorOptions?: string[];
  sizeOptions?: string[];
  otherImageUrls?: string[];
  isActive?: boolean;
};

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(trimmed);
  }

  return normalized;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  const body = (await request.json()) as ProductUpdatePayload;

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const normalizedColorOptions = normalizeStringArray(body.colorOptions);
    const normalizedSizeOptions = normalizeStringArray(body.sizeOptions);
    const normalizedOtherImageUrls = normalizeStringArray(body.otherImageUrls);

    const patchPayload = {
      ...body,
      ...(normalizedColorOptions ? { colorOptions: normalizedColorOptions } : {}),
      ...(normalizedSizeOptions ? { sizeOptions: normalizedSizeOptions } : {}),
      ...(normalizedOtherImageUrls ? { otherImageUrls: normalizedOtherImageUrls } : {}),
      ...(body.slug || body.name ? { slug: ensureSlug(body.slug ?? body.name ?? "", productId) } : {}),
    };

    const updated = await databases.updateDocument(databaseId, "sku", productId, {
      ...patchPayload,
    });

    return NextResponse.json({ ok: true, product: updated });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update product.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
