import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { PRODUCT_CATALOG_CACHE_TAG, PRODUCT_SEARCH_INDEX_CACHE_TAG } from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import { removeProductSearchEntry, upsertProductSearchEntry } from "@/lib/firebase/product-search-index";
import { getTotalSizeStock, parseColorMedia, parseSizeChartSnapshot, parseSizeInventory } from "@/lib/product-merchandising";
import { normalizeProductCategory } from "@/lib/product-taxonomy";
import { ensureSlug } from "@/lib/slug";

export const runtime = "nodejs";

const productUpdateSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(10_000).optional(),
  sku: z.string().trim().min(1).max(100).optional(),
  slug: z.string().trim().max(180).optional(),
  category: z.string().trim().max(80).optional(),
  subCategory: z.string().trim().max(80).optional(),
  mainImageUrl: z.string().trim().url().optional(),
  discountPrice: z.number().finite().nonnegative().optional(),
  originalPrice: z.number().finite().nonnegative().optional(),
  stockQty: z.number().finite().int().nonnegative().optional(),
  colorOptions: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  sizeOptions: z.array(z.string().trim().min(1).max(24)).max(30).optional(),
  otherImageUrls: z.array(z.string().trim().url()).max(20).optional(),
  sizeInventory: z.unknown().optional(),
  colorMedia: z.unknown().optional(),
  sizeChartId: z.string().trim().max(120).optional(),
  sizeChart: z.unknown().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { productId } = await context.params;
  if (!productId.trim()) return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  const result = productUpdateSchema.safeParse(await request.json());
  if (!result.success) return NextResponse.json({ error: "Invalid product fields.", issues: result.error.flatten() }, { status: 400 });

  try {
    const reference = getAdminDb().collection(FIRESTORE_COLLECTIONS.products).doc(productId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    const existing = snapshot.data() ?? {};
    const input = result.data;
    const name = input.name ?? String(existing.name ?? "");
    const description = input.description ?? String(existing.description ?? "");
    const taxonomy = normalizeProductCategory({
      categoryRaw: input.category ?? String(existing.category ?? ""),
      subCategoryRaw: input.subCategory ?? String(existing.subCategory ?? existing.subcategory ?? ""),
      name,
      description,
    });
    const sizeInventory = input.sizeInventory === undefined ? parseSizeInventory(existing.sizeInventory) : parseSizeInventory(input.sizeInventory);
    const stockQty = sizeInventory.length > 0 ? getTotalSizeStock(sizeInventory) : input.stockQty ?? Number(existing.stockQty ?? 0);
    const slug = input.slug || input.name
      ? ensureSlug(input.slug ?? input.name ?? name, input.sku ?? String(existing.sku ?? productId))
      : String(existing.slug ?? "");
    const payload = {
      ...input,
      name,
      description,
      category: taxonomy.category,
      subCategory: taxonomy.subCategory,
      subcategory: taxonomy.subCategory,
      slug,
      stockQty,
      inStock: stockQty > 0,
      ...(input.sizeInventory === undefined ? {} : { sizeInventory, sizeOptions: sizeInventory.map((item) => item.size) }),
      ...(input.colorMedia === undefined ? {} : { colorMedia: parseColorMedia(input.colorMedia) }),
      ...(input.sizeChart === undefined ? {} : { sizeChart: parseSizeChartSnapshot(input.sizeChart) }),
      updatedAt: new Date().toISOString(),
    };
    await reference.set(payload, { merge: true });
    const isActive = input.isActive ?? existing.isActive !== false;
    if (isActive) {
      await upsertProductSearchEntry({ id: productId, name, slug, category: taxonomy.category, subCategory: taxonomy.subCategory });
    } else {
      await removeProductSearchEntry(productId);
    }
    revalidateTag(PRODUCT_CATALOG_CACHE_TAG, { expire: 0 });
    revalidateTag(PRODUCT_SEARCH_INDEX_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ ok: true, product: { ...existing, ...payload, id: productId } });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update product.", detail: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
