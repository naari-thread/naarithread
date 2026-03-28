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
  colorOptions?: string[];
  sizeOptions?: string[];
  otherImageUrls?: string[];
  isActive?: boolean;
};

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

    const patchPayload = {
      ...body,
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
