import { NextResponse } from "next/server";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const ORDERS_COL = "orders";

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const [body, user] = await Promise.all([
      request.json() as Promise<{ orderId?: unknown }>,
      getUserFromJwt(token),
    ]);
    const orderId = typeof body.orderId === "string" ? body.orderId.trim().slice(0, 64) : "";
    if (!orderId) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 });
    }

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const order = await databases.getDocument(databaseId, ORDERS_COL, orderId);
    if (String(order.userId ?? "") !== user.$id) {
      return NextResponse.json({ error: "Order does not belong to current user." }, { status: 403 });
    }

    const paymentStatus = String(order.paymentStatus ?? "").toLowerCase();
    if (paymentStatus === "paid" || paymentStatus.startsWith("refunded")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    await databases.updateDocument(databaseId, ORDERS_COL, orderId, {
      status: "payment_cancelled",
      paymentStatus: "cancelled",
      cancelledAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not close the payment attempt." }, { status: 500 });
  }
}
