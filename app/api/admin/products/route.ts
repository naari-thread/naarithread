import { NextResponse } from "next/server";
import { ID } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { ensureSlug } from "@/lib/slug";

export const runtime = "nodejs";

type ProductPayload = {
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
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as ProductPayload;

  if (!body.name || !body.description || !body.sku || !body.category || !body.mainImageUrl) {
    return badRequest("Missing required product fields.");
  }

  if (typeof body.discountPrice !== "number" || typeof body.originalPrice !== "number") {
    return badRequest("discountPrice and originalPrice must be numbers.");
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const document = await databases.createDocument(databaseId, "sku", ID.unique(), {
      name: body.name,
      description: body.description,
      sku: body.sku,
      slug: ensureSlug(body.slug ?? body.name, body.sku),
      category: body.category,
      mainImageUrl: body.mainImageUrl,
      discountPrice: body.discountPrice,
      originalPrice: body.originalPrice,
      stockQty: body.stockQty ?? 0,
      rating: 0,
      ratingCount: 0,
      reviewIds: [],
      colorOptions: body.colorOptions ?? [],
      sizeOptions: body.sizeOptions ?? [],
      otherImageUrls: body.otherImageUrls ?? [],
      isActive: true,
    });

    return NextResponse.json({ ok: true, product: document }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create product.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
