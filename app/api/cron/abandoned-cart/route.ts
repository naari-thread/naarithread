import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { sendAbandonedCartEmail } from "@/lib/email/send";

export const runtime = "nodejs";

const CARTS_COL = "carts";
const ORDERS_COL = "orders";

export async function GET(request: Request) {
  // Gate: Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    // Carts updated between 24 h and 72 h ago with at least 1 item
    const now = new Date();
    const cutoffStart = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString();
    const cutoffEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const carts = await databases.listDocuments(databaseId, CARTS_COL, [
      Query.greaterThanEqual("$updatedAt", cutoffStart),
      Query.lessThanEqual("$updatedAt", cutoffEnd),
      Query.isNotNull("userId"),
      Query.limit(100),
    ]);

    if (carts.documents.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Collect unique userIds that have carts
    const userIdToCartCount = new Map<string, number>();
    for (const doc of carts.documents) {
      const uid = String((doc as Record<string, unknown>).userId ?? "");
      if (uid) userIdToCartCount.set(uid, (userIdToCartCount.get(uid) ?? 0) + 1);
    }

    // Filter out users who already placed an order in the last 72h
    const userIds = Array.from(userIdToCartCount.keys());
    const recentOrders = await databases.listDocuments(databaseId, ORDERS_COL, [
      Query.equal("userId", userIds),
      Query.greaterThanEqual("$createdAt", cutoffStart),
      Query.limit(userIds.length),
    ]);
    const usersWithOrders = new Set(recentOrders.documents.map((d) => String((d as Record<string, unknown>).userId ?? "")));

    let sent = 0;
    for (const [userId, itemCount] of userIdToCartCount) {
      if (usersWithOrders.has(userId)) continue;

      // Get user email from users collection
      try {
        const userDoc = await databases.getDocument(databaseId, "users", userId);
        const email = String((userDoc as Record<string, unknown>).email ?? "");
        const name = String((userDoc as Record<string, unknown>).fullName ?? (userDoc as Record<string, unknown>).name ?? "");
        if (!email) continue;

        await sendAbandonedCartEmail(email, { customerName: name, itemCount });
        sent++;
      } catch {
        // User doc not found or email missing — skip
      }
    }

    return NextResponse.json({ sent });
  } catch (error) {
    return NextResponse.json({ error: "Cron job failed.", detail: error instanceof Error ? error.message : "Unknown" }, { status: 500 });
  }
}
