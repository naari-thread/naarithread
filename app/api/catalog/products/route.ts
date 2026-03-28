import { NextResponse } from "next/server";

import { listProductsFromCollection } from "@/lib/appwrite/products";

export const runtime = "nodejs";

export async function GET() {
  try {
    const products = await listProductsFromCollection();
    return NextResponse.json({ products }, { status: 200 });
  } catch {
    return NextResponse.json({ products: [] }, { status: 200 });
  }
}
