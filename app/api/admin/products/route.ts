import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";

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

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
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

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get("limit") ?? 40);
    const offsetParam = Number(searchParams.get("offset") ?? 0);
    const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, Math.trunc(limitParam))) : 40;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.trunc(offsetParam)) : 0;

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const response = await databases.listDocuments(databaseId, "sku", [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderDesc("$createdAt"),
    ]);

    const products = response.documents.map((document) => ({
      id: document.$id,
      slug: document.slug ?? "",
      name: document.name ?? "Untitled Product",
      category: document.category ?? "",
      subCategory: document.subCategory ?? document.subcategory ?? "",
      sizeOptions: normalizeStringArray(document.sizeOptions),
      discountPrice: Number(document.discountPrice ?? 0),
      originalPrice: Number(document.originalPrice ?? 0),
      stockQty: Number(document.stockQty ?? 0),
      isActive: typeof document.isActive === "boolean" ? document.isActive : true,
    }));

    return NextResponse.json({ ok: true, products, total: response.total });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to list products.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
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
      colorOptions: normalizeStringArray(body.colorOptions),
      sizeOptions: normalizeStringArray(body.sizeOptions),
      otherImageUrls: normalizeStringArray(body.otherImageUrls),
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
