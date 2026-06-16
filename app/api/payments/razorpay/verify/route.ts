import { NextResponse } from "next/server";
import { ID, Permission, Query, Role, type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import {
  applyPaymentTransition,
  canPaymentUpdateOrderStatus,
  getRazorpayClient,
  mapRazorpayPaymentStatus,
  toOrderStatus,
  verifyCheckoutSignature,
} from "@/lib/payments/razorpay-server";

export const runtime = "nodejs";

const SCOPE = "payments.verify";
const ORDERS_COL = "orders";
const PAYMENTS_COL = "payments";

type VerifyPayload = {
  internalOrderId?: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function normalize(value: unknown, maxLength = 140) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const [body, user] = await Promise.all([request.json() as Promise<VerifyPayload>, getUserFromJwt(token)]);

    const internalOrderId = normalize(body.internalOrderId, 64);
    const razorpayOrderId = normalize(body.razorpay_order_id, 80);
    const razorpayPaymentId = normalize(body.razorpay_payment_id, 120);
    const razorpaySignature = normalize(body.razorpay_signature, 180);

    log("info", SCOPE, "received", { correlationId, internalOrderId, razorpayOrderId, razorpayPaymentId });

    if (!internalOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing payment verification fields." }, { status: 400 });
    }

    const razorpay = getRazorpayClient();
    const isSignatureValid = verifyCheckoutSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      keySecret: razorpay.keySecret,
    });

    if (!isSignatureValid) {
      log("warn", SCOPE, "signature_invalid", { correlationId, internalOrderId, userId: user.$id });
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
    }

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const [order, paymentsList, razorpayPayment] = await Promise.all([
      databases.getDocument(databaseId, ORDERS_COL, internalOrderId),
      databases.listDocuments(databaseId, PAYMENTS_COL, [
        Query.equal("orderId", internalOrderId),
        Query.equal("provider", "razorpay"),
        Query.limit(1),
      ]),
      razorpay.client.payments.fetch(razorpayPaymentId),
    ]);

    if (String(order.userId ?? "") !== user.$id) {
      return NextResponse.json({ error: "Order does not belong to current user." }, { status: 403 });
    }

    if (String(order.paymentId ?? "") && String(order.paymentId ?? "") !== razorpayOrderId) {
      return NextResponse.json({ error: "Order mismatch for payment verification." }, { status: 400 });
    }

    const paymentState = mapRazorpayPaymentStatus(String(razorpayPayment.status ?? ""));
    const paymentDoc = paymentsList.documents[0] ?? null;

    const currentPaymentStatus = String(paymentDoc?.status ?? order.paymentStatus ?? "created");
    const paymentTransition = applyPaymentTransition(currentPaymentStatus, paymentState);
    const nextPaymentStatus = paymentTransition.next;
    const isPaid = nextPaymentStatus === "paid";

    const writes: Promise<unknown>[] = [];
    const paymentMeta = JSON.stringify({
      razorpayOrderId,
      razorpayPaymentId,
      razorpayStatus: razorpayPayment.status,
      method: razorpayPayment.method,
      bank: razorpayPayment.bank,
      wallet: razorpayPayment.wallet,
      email: razorpayPayment.email,
      contact: razorpayPayment.contact,
      verifiedAt: new Date().toISOString(),
    });

    if (paymentDoc && paymentTransition.changed) {
      writes.push(
        databases.updateDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, paymentDoc.$id, {
          providerPaymentId: razorpayPaymentId,
          status: nextPaymentStatus,
          paymentMeta,
          ...(isPaid ? { paidAt: new Date().toISOString() } : paymentDoc.paidAt ? { paidAt: paymentDoc.paidAt } : {}),
        })
      );
    } else if (!paymentDoc) {
      // Payment doc doesn't exist yet (created here, not at order initiation).
      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.read(Role.label("admin")),
        Permission.update(Role.label("admin")),
      ];
      writes.push(
        databases.createDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, ID.unique(), {
          userId: user.$id,
          orderId: internalOrderId,
          provider: "razorpay",
          providerPaymentId: razorpayPaymentId,
          status: nextPaymentStatus,
          amount: Number(order.totalAmount ?? 0),
          currency: "INR",
          paymentMeta,
          ...(isPaid ? { paidAt: new Date().toISOString() } : {}),
        }, permissions)
      );
    }

    const orderStatus = toOrderStatus(nextPaymentStatus as never);
    if (paymentTransition.changed && canPaymentUpdateOrderStatus(String(order.status ?? ""))) {
      writes.push(
        databases.updateDocument<Models.DefaultDocument>(databaseId, ORDERS_COL, internalOrderId, {
          paymentStatus: nextPaymentStatus,
          status: orderStatus,
        })
      );
    }

    if (writes.length > 0) await Promise.all(writes);

    log("info", SCOPE, "completed", {
      correlationId,
      internalOrderId,
      userId: user.$id,
      paymentState: nextPaymentStatus,
      changed: paymentTransition.changed,
    });

    return NextResponse.json({ ok: true, internalOrderId, paymentState: nextPaymentStatus, orderStatus });
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, message: errorMessage(error) });
    return NextResponse.json({ error: "Failed to verify Razorpay payment.", correlationId }, { status: 500 });
  }
}
