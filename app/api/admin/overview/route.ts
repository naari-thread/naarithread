import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const [products, orders, payments, reviews, pendingOrders, deliveredOrders] = await Promise.all([
      databases.listDocuments(databaseId, "sku", [Query.limit(1)]),
      databases.listDocuments(databaseId, "orders", [Query.limit(1)]),
      databases.listDocuments(databaseId, "payments", [Query.limit(1)]),
      databases.listDocuments(databaseId, "reviews", [Query.limit(1)]),
      databases.listDocuments(databaseId, "orders", [
        Query.equal("status", ["placed", "confirmed", "shipped", "out_for_delivery"]),
        Query.limit(1),
      ]),
      databases.listDocuments(databaseId, "orders", [
        Query.equal("status", ["delivered", "completed"]),
        Query.limit(1),
      ]),
    ]);

    return NextResponse.json({
      products: products.total,
      orders: orders.total,
      payments: payments.total,
      reviews: reviews.total,
      pendingFulfillment: pendingOrders.total,
      delivered: deliveredOrders.total,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load admin overview." },
      { status: 500 }
    );
  }
}
