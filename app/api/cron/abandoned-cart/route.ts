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
  const cronSecret = process.env.CRON_SECRET?.trim() ?? "";
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
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

    // Group carts by user, tracking each doc id and when (if ever) a reminder was sent.
    type CartRef = { docId: string; sentAt: string };
    const userIdToCarts = new Map<string, CartRef[]>();
    for (const doc of carts.documents) {
      const d = doc as Record<string, unknown>;
      const uid = String(d.userId ?? "");
      if (!uid) continue;
      const list = userIdToCarts.get(uid) ?? [];
      list.push({ docId: String(doc.$id), sentAt: String(d.abandonedCartSentAt ?? "") });
      userIdToCarts.set(uid, list);
    }

    const userIds = Array.from(userIdToCarts.keys());
    if (userIds.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Filter out users who already placed an order in the last 72h
    const recentOrders = await databases.listDocuments(databaseId, ORDERS_COL, [
      Query.equal("userId", userIds),
      Query.greaterThanEqual("$createdAt", cutoffStart),
      Query.limit(userIds.length),
    ]);
    const usersWithOrders = new Set(recentOrders.documents.map((d) => String((d as Record<string, unknown>).userId ?? "")));

    const nowIso = now.toISOString();
    let sent = 0;
    for (const [userId, cartRefs] of userIdToCarts) {
      if (usersWithOrders.has(userId)) continue;

      // Dedup: skip if a reminder was already sent for this abandonment cycle
      // (within the 72h window). Prevents re-emailing the same cart on each daily run.
      const alreadyReminded = cartRefs.some((c) => c.sentAt && c.sentAt >= cutoffStart);
      if (alreadyReminded) continue;

      // Get user email from users collection
      try {
        const userDoc = await databases.getDocument(databaseId, "users", userId);
        const email = String((userDoc as Record<string, unknown>).email ?? "");
        const name = String((userDoc as Record<string, unknown>).fullName ?? (userDoc as Record<string, unknown>).name ?? "");
        if (!email) continue;

        await sendAbandonedCartEmail(email, { customerName: name, itemCount: cartRefs.length });

        // Stamp every cart doc for this user so the next daily run skips them.
        await Promise.all(
          cartRefs.map((c) =>
            databases
              .updateDocument(databaseId, CARTS_COL, c.docId, { abandonedCartSentAt: nowIso })
              .catch(() => undefined),
          ),
        );

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
