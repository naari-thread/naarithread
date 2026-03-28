import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const [products, orders, payments, reviews] = await Promise.all([
      databases.listDocuments(databaseId, "sku", [Query.limit(1)]),
      databases.listDocuments(databaseId, "orders", [Query.limit(1)]),
      databases.listDocuments(databaseId, "payments", [Query.limit(1)]),
      databases.listDocuments(databaseId, "reviews", [Query.limit(1)]),
    ]);

    return NextResponse.json({
      products: products.total,
      orders: orders.total,
      payments: payments.total,
      reviews: reviews.total,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load admin overview.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
