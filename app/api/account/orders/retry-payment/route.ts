import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";
import { getRazorpayClient, toPaise } from "@/lib/payments/razorpay-server";

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

function normalize(value: unknown, maxLength = 64) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function makeReceipt(orderId: string) {
  return `NTRTRY${Date.now()}${orderId.slice(0, 8)}`.slice(0, 40);
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const [body, user] = await Promise.all([request.json(), getUserFromJwt(token)]);
    const orderId = normalize((body as { orderId?: unknown })?.orderId, 64);

    if (!orderId) {
      return NextResponse.json({ error: "Missing order id." }, { status: 400 });
    }

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

    const order = await databases.getDocument(databaseId, ordersCollectionId, orderId);
    if (String(order.userId ?? "") !== user.$id) {
      return NextResponse.json({ error: "Order does not belong to current user." }, { status: 403 });
    }

    const paymentStatus = String(order.paymentStatus ?? "").toLowerCase();
    if (paymentStatus === "paid" || paymentStatus === "captured") {
      return NextResponse.json({ error: "Order is already paid." }, { status: 400 });
    }

    if (paymentStatus === "refunded_to_wallet" || paymentStatus === "refunded") {
      return NextResponse.json({ error: "Refunded orders cannot be repaid." }, { status: 400 });
    }

    const total = Math.max(0, toNumber(order.totalAmount));
    const amount = toPaise(total);

    if (amount <= 0) {
      return NextResponse.json({ error: "Order amount is invalid for payment retry." }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const receipt = makeReceipt(orderId);
    const razorpayOrder = await razorpay.client.orders.create({
      amount,
      currency: String(order.currency ?? "INR") || "INR",
      receipt,
      payment_capture: true,
      notes: {
        internalOrderId: orderId,
        userId: user.$id,
        retry: "true",
      },
    });

    const payments = await databases.listDocuments(databaseId, paymentsCollectionId, [
      Query.equal("orderId", orderId),
      Query.equal("provider", "razorpay"),
      Query.limit(1),
    ]);

    const paymentDoc = payments.documents[0] ?? null;
    const paymentMeta = JSON.stringify({
      razorpayOrderId: razorpayOrder.id,
      receipt,
      retryAt: new Date().toISOString(),
    });

    await Promise.all([
      paymentDoc
        ? databases.updateDocument(databaseId, paymentsCollectionId, paymentDoc.$id, {
            status: "created",
            providerPaymentId: "",
            paymentMeta,
            paidAt: null,
          })
        : databases.createDocument(databaseId, paymentsCollectionId, ID.unique(), {
            userId: user.$id,
            orderId,
            provider: "razorpay",
            providerPaymentId: "",
            status: "created",
            amount: total,
            currency: "INR",
            paymentMeta,
            paidAt: null,
          }),
      databases.updateDocument(databaseId, ordersCollectionId, orderId, {
        paymentStatus: "created",
        status: "initiated",
        paymentId: razorpayOrder.id,
      }),
    ]);

    return NextResponse.json({
      keyId: razorpay.keyId,
      currency: "INR",
      amount,
      razorpayOrderId: razorpayOrder.id,
      internalOrderId: orderId,
      customer: {
        name: user.name ?? "",
        email: user.email ?? "",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to initialize retry payment.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
