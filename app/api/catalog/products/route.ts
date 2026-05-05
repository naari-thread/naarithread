import { NextResponse } from "next/server";

import { listProductsPageFromCollection } from "@/lib/appwrite/products";

export const runtime = "nodejs";
export const revalidate = 1800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? "12");
  const offsetParam = Number(searchParams.get("offset") ?? "0");

  const limit = Number.isFinite(limitParam) ? Math.min(100, Math.max(1, Math.trunc(limitParam))) : 12;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.trunc(offsetParam)) : 0;

  try {
    const result = await listProductsPageFromCollection({ limit, offset });
    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        products: [],
        total: 0,
        hasMore: false,
        nextOffset: null,
      },
      { status: 200 }
    );
  }
}
