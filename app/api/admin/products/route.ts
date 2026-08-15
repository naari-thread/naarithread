import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { toProductRecord } from "@/lib/appwrite/products";
import { PRODUCT_CATALOG_CACHE_TAG, PRODUCT_SEARCH_INDEX_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import { upsertProductSearchEntry } from "@/lib/firebase/product-search-index";
import { getTotalSizeStock, parseColorMedia, parseSizeChartSnapshot, parseSizeInventory } from "@/lib/product-merchandising";
import { normalizeProductCategory } from "@/lib/product-taxonomy";
import { ensureSlug } from "@/lib/slug";

export const runtime = "nodejs";

const productPayloadSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(10_000),
  sku: z.string().trim().min(1).max(100),
  slug: z.string().trim().max(180).optional(),
  category: z.string().trim().min(1).max(80),
  subCategory: z.string().trim().max(80).optional().default(""),
  mainImageUrl: z.string().trim().url(),
  discountPrice: z.number().finite().nonnegative(),
  originalPrice: z.number().finite().nonnegative(),
  stockQty: z.number().finite().int().nonnegative().optional().default(0),
  colorOptions: z.array(z.string().trim().min(1).max(60)).max(30).optional().default([]),
  sizeOptions: z.array(z.string().trim().min(1).max(24)).max(30).optional().default([]),
  otherImageUrls: z.array(z.string().trim().url()).max(20).optional().default([]),
  sizeInventory: z.unknown().optional(),
  colorMedia: z.unknown().optional(),
  sizeChartId: z.string().trim().max(120).optional().default(""),
  sizeChart: z.unknown().optional(),
});

function refreshCatalog(): void {
  revalidateTag(PRODUCT_CATALOG_CACHE_TAG, { expire: 0 });
  revalidateTag(PRODUCT_SEARCH_INDEX_CACHE_TAG, { expire: 0 });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, Math.trunc(Number(searchParams.get("limit") ?? 40) || 40)));
    const offset = Math.max(0, Math.trunc(Number(searchParams.get("offset") ?? 0) || 0));
    const snapshot = await getAdminDb().collection(FIRESTORE_COLLECTIONS.products).limit(500).get();
    const products = snapshot.docs
      .map((document) => toProductRecord({ ...document.data(), $id: document.id }))
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    return NextResponse.json({ ok: true, products: products.slice(offset, offset + limit), total: products.length });
  } catch (error) {
    return NextResponse.json({ error: "Failed to list products.", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = productPayloadSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "Invalid product fields.", issues: result.error.flatten() }, { status: 400 });

  try {
    const input = result.data;
    const taxonomy = normalizeProductCategory({
      categoryRaw: input.category,
      subCategoryRaw: input.subCategory,
      name: input.name,
      description: input.description,
    });
    const sizeInventory = parseSizeInventory(input.sizeInventory);
    const stockQty = sizeInventory.length > 0 ? getTotalSizeStock(sizeInventory) : input.stockQty;
    const reference = getAdminDb().collection(FIRESTORE_COLLECTIONS.products).doc();
    const nowIso = new Date().toISOString();
    const payload = {
      ...input,
      category: taxonomy.category,
      subCategory: taxonomy.subCategory,
      subcategory: taxonomy.subCategory,
      slug: ensureSlug(input.slug ?? input.name, input.sku),
      stockQty,
      inStock: stockQty > 0,
      sizeOptions: sizeInventory.length > 0 ? sizeInventory.map((item) => item.size) : input.sizeOptions,
      sizeInventory,
      colorMedia: parseColorMedia(input.colorMedia),
      sizeChart: parseSizeChartSnapshot(input.sizeChart),
      rating: 0,
      ratingCount: 0,
      isActive: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await reference.set(payload);
    await upsertProductSearchEntry({
      id: reference.id,
      name: input.name,
      slug: payload.slug,
      category: taxonomy.category,
      subCategory: taxonomy.subCategory,
    });
    refreshCatalog();
    return NextResponse.json({ ok: true, product: toProductRecord({ ...payload, $id: reference.id }) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create product.", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
