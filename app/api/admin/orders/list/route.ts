import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";

export const runtime = "nodejs";

const ORDERS_COL = "orders";

function toNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseItems(raw: unknown) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Record<string, unknown>[]).map((item) => ({
      productName: String(item.productName ?? "Product"),
      quantity: toNumber(item.quantity),
      lineAmount: toNumber(item.lineAmount),
    }));
  } catch { return []; }
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 30)));
  const statusFilter = url.searchParams.get("status");

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const queries = [
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
      Query.offset(offset),
    ];
    if (statusFilter) queries.push(Query.equal("status", statusFilter));

    const result = await databases.listDocuments(databaseId, ORDERS_COL, queries);

    return NextResponse.json({
      orders: result.documents.map((doc) => {
        const d = doc as Record<string, unknown>;
        return {
          id: doc.$id,
          orderNumber: String(d.orderNumber ?? doc.$id),
          status: String(d.status ?? "placed"),
          paymentStatus: String(d.paymentStatus ?? ""),
          totalAmount: toNumber(d.totalAmount),
          userEmail: String(d.userEmail ?? ""),
          userId: String(d.userId ?? ""),
          placedAt: String(d.placedAt ?? doc.$createdAt ?? ""),
          items: parseItems(d.itemsJson),
        };
      }),
      total: result.total,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load orders." }, { status: 500 });
  }
}
