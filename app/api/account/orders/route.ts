import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

type OrderLine = {
  productId: string;
  quantity: number;
  productName: string;
  unitAmount: number;
  lineAmount: number;
};

function parseOrderLines(raw: unknown) {
  if (typeof raw !== "string") {
    return [] as OrderLine[];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [] as OrderLine[];
    }

    return parsed
      .filter((line) => line && typeof line === "object")
      .map((line) => {
        const item = line as Record<string, unknown>;
        return {
          productId: String(item.productId ?? ""),
          quantity: Math.max(0, Math.trunc(toNumber(item.quantity))),
          productName: String(item.productName ?? "Product"),
          unitAmount: Math.max(0, toNumber(item.unitAmount)),
          lineAmount: Math.max(0, toNumber(item.lineAmount)),
        };
      })
      .filter((line) => line.productId && line.quantity > 0);
  } catch {
    return [] as OrderLine[];
  }
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(token);
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const ordersCollectionId =
      (await resolveCollectionId({
        databases,
        databaseId,
        candidates: ["orders", "order"],
      })) ?? "orders";
    const paymentsCollectionId =
      (await resolveCollectionId({
        databases,
        databaseId,
        candidates: ["payments", "payment"],
      })) ?? "payments";

    const ordersList = await databases.listDocuments(databaseId, ordersCollectionId, [
      Query.equal("userId", user.$id),
      Query.orderDesc("$createdAt"),
      Query.limit(30),
    ]);

    const orderIds = ordersList.documents.map((doc) => String(doc.$id));

    const paymentsByOrderId = new Map<string, Record<string, unknown>>();
    if (orderIds.length > 0) {
      const paymentsList = await databases.listDocuments(databaseId, paymentsCollectionId, [
        Query.equal("orderId", orderIds),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);

      for (const payment of paymentsList.documents as unknown as Record<string, unknown>[]) {
        const orderId = String(payment.orderId ?? "");
        if (!orderId || paymentsByOrderId.has(orderId)) {
          continue;
        }

        paymentsByOrderId.set(orderId, payment);
      }
    }

    return NextResponse.json({
      orders: ordersList.documents.filter(
        (doc) => String((doc as Record<string, unknown>).status ?? "").toLowerCase() !== "payment_cancelled",
      ).map((doc) => {
        const payment = paymentsByOrderId.get(doc.$id);
        const totalAmount = Math.max(0, toNumber((doc as Record<string, unknown>).totalAmount));
        const shippingAmount = Math.max(0, toNumber((doc as Record<string, unknown>).shippingAmount));
        const discountAmount = Math.max(0, toNumber((doc as Record<string, unknown>).discountAmount));

        return {
          id: doc.$id,
          orderNumber: String((doc as Record<string, unknown>).orderNumber ?? doc.$id),
          status: String((doc as Record<string, unknown>).status ?? "pending"),
          paymentStatus: String((doc as Record<string, unknown>).paymentStatus ?? "pending"),
          totalAmount,
          shippingAmount,
          discountAmount,
          placedAt: String((doc as Record<string, unknown>).placedAt ?? doc.$createdAt ?? ""),
          shippingAddress: String((doc as Record<string, unknown>).shippingAddress ?? ""),
          items: parseOrderLines((doc as Record<string, unknown>).itemsJson),
          payment: payment
            ? {
                provider: String(payment.provider ?? "razorpay"),
                status: String(payment.status ?? "created"),
                providerPaymentId: String(payment.providerPaymentId ?? ""),
                createdAt: String(payment.$createdAt ?? ""),
              }
            : null,
          canRetryPayment: ["created", "authorized", "failed", "payment_failed", "initiated", "payment_pending", "cancelled"].includes(
            String((doc as Record<string, unknown>).paymentStatus ?? "").toLowerCase()
          ),
        };
      }),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load orders.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
