import { NextResponse } from "next/server";

import { getProductsByIds, listProductsPageFromCollection } from "@/lib/appwrite/products";
import { isProductCategorySlug, isProductSubCategorySlug } from "@/lib/product-taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVALIDATE_RESPONSE_HEADERS = {
  "Cache-Control": "public, max-age=0, must-revalidate",
} as const;

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);

  const idsParam = searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 100);

  try {
    if (ids.length > 0) {
      const products = await getProductsByIds(ids);
      return NextResponse.json(
        { products, total: products.length, hasMore: false, nextOffset: null },
        {
          status: 200,
          headers: REVALIDATE_RESPONSE_HEADERS,
        }
      );
    }

    const limitValue = Number(searchParams.get("limit") ?? 24);
    const offsetValue = Number(searchParams.get("offset") ?? 0);
    const categoryValue = searchParams.get("category") ?? "";
    const subCategoryValue = searchParams.get("subcategory") ?? "";
    const page = await listProductsPageFromCollection({
      limit: Number.isFinite(limitValue) ? limitValue : 24,
      offset: Number.isFinite(offsetValue) ? offsetValue : 0,
      ...(isProductCategorySlug(categoryValue) ? { category: categoryValue } : {}),
      ...(isProductSubCategorySlug(subCategoryValue) ? { subCategory: subCategoryValue } : {}),
    });
    return NextResponse.json(
      page,
      {
        status: 200,
        headers: REVALIDATE_RESPONSE_HEADERS,
      }
    );
  } catch (error) {
    console.error("[catalog-products-api] Failed to load catalog products:", error);
    return NextResponse.json(
      { error: "Failed to load products from catalog." },
      { status: 500 }
    );
  }
}
