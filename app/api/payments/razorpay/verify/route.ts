import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { Permission, Query, Role, type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { createUserNotification } from "@/lib/appwrite/notifications";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { markCouponRedeemedForPaidOrder } from "@/lib/payments/coupon-usage";
import { sendPaidOrderConfirmationOnce } from "@/lib/payments/order-confirmation";
import { reduceStockForPaidOrder } from "@/lib/payments/order-stock";
import { reconcileCapturedPayment, refundDuplicateCapturedPayment } from "@/lib/payments/payment-reconciliation";
import {
  applyPaymentTransition,
  getRazorpayClient,
  mapRazorpayPaymentStatus,
  toPaise,
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

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function normalize(value: unknown, maxLength = 140): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const [body, user] = await Promise.all([
      request.json() as Promise<VerifyPayload>,
      getUserFromJwt(token),
    ]);

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

    if (String(razorpayPayment.order_id ?? "") !== razorpayOrderId) {
      return NextResponse.json({ error: "Razorpay payment does not belong to this payment order." }, { status: 400 });
    }

    const expectedAmount = toPaise(Number(order.totalAmount ?? 0));
    const paidAmount = Number(razorpayPayment.amount ?? 0);
    const paidCurrency = String(razorpayPayment.currency ?? "").toUpperCase();
    if (paidAmount !== expectedAmount || paidCurrency !== "INR") {
      log("warn", SCOPE, "amount_mismatch", { correlationId, internalOrderId, expectedAmount, paidAmount, paidCurrency });
      return NextResponse.json({ error: "Payment amount or currency does not match this order." }, { status: 400 });
    }

    const paymentState = mapRazorpayPaymentStatus(String(razorpayPayment.status ?? ""));
    const paymentDoc = paymentsList.documents[0] ?? null;
    const currentPaymentStatus = String(paymentDoc?.status ?? order.paymentStatus ?? "created");
    const paymentTransition = applyPaymentTransition(currentPaymentStatus, paymentState);
    const nextPaymentStatus = paymentTransition.next;
    const isPaid = nextPaymentStatus === "paid";
    const paymentMeta = {
      razorpayOrderId,
      razorpayPaymentId,
      razorpayStatus: razorpayPayment.status,
      method: razorpayPayment.method,
      bank: razorpayPayment.bank,
      wallet: razorpayPayment.wallet,
      email: razorpayPayment.email,
      contact: razorpayPayment.contact,
      verifiedAt: new Date().toISOString(),
    };

    let orderStatus = toOrderStatus(nextPaymentStatus as never);
    let shouldRunPostPayment = false;
    let duplicateCapture: Awaited<ReturnType<typeof reconcileCapturedPayment>>["duplicateCapture"] = null;

    if (isPaid) {
      const reconciliation = await reconcileCapturedPayment({
        correlationId,
        internalOrderId,
        userId: user.$id,
        orderStatusWhenPaid: orderStatus,
        razorpayOrderId,
        razorpayPaymentId,
        amount: Number(order.totalAmount ?? 0),
        currency: "INR",
        metaPatch: paymentMeta,
      });
      orderStatus = reconciliation.orderStatus;
      shouldRunPostPayment = reconciliation.shouldRunPostPayment;
      duplicateCapture = reconciliation.duplicateCapture;
    } else if (paymentDoc && paymentTransition.changed) {
      await databases.updateDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, paymentDoc.$id, {
        providerPaymentId: razorpayPaymentId,
        status: nextPaymentStatus,
        paymentMeta: JSON.stringify(paymentMeta),
        ...(paymentDoc.paidAt ? { paidAt: paymentDoc.paidAt } : {}),
      });
      await databases.updateDocument<Models.DefaultDocument>(databaseId, ORDERS_COL, internalOrderId, {
        paymentStatus: nextPaymentStatus,
        status: orderStatus,
      });
    } else if (!paymentDoc) {
      const permissions = [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.read(Role.label("admin")),
        Permission.update(Role.label("admin")),
      ];
      await databases.createDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, internalOrderId, {
        userId: user.$id,
        orderId: internalOrderId,
        provider: "razorpay",
        providerPaymentId: razorpayPaymentId,
        status: nextPaymentStatus,
        amount: Number(order.totalAmount ?? 0),
        currency: "INR",
        paymentMeta: JSON.stringify(paymentMeta),
      }, permissions);
      if (paymentTransition.changed) {
        await databases.updateDocument<Models.DefaultDocument>(databaseId, ORDERS_COL, internalOrderId, {
          paymentStatus: nextPaymentStatus,
          status: orderStatus,
        });
      }
    }

    if (isPaid && shouldRunPostPayment) {
      await reduceStockForPaidOrder(internalOrderId);
      await markCouponRedeemedForPaidOrder(internalOrderId);
      await sendPaidOrderConfirmationOnce(internalOrderId);
      revalidateTag(PRODUCT_CATALOG_CACHE_TAG, { expire: 0 });
      revalidatePath("/products");
      revalidatePath("/products", "layout");
      revalidatePath("/api/catalog/products");

      createUserNotification({
        userId: user.$id,
        title: "Order Confirmed",
        body: `Your order ${String(order.orderNumber ?? internalOrderId)} has been placed successfully.`,
        type: "order",
        metadata: { orderId: internalOrderId },
      }).catch((err: unknown) => {
        log("warn", SCOPE, "notification_failed", { correlationId, message: errorMessage(err) });
      });
    }

    if (duplicateCapture) {
      await refundDuplicateCapturedPayment({
        correlationId,
        internalOrderId,
        orderNumber: String(order.orderNumber ?? internalOrderId),
        userId: user.$id,
        paymentDocId: internalOrderId,
        duplicateCapture,
      });
    }

    log("info", SCOPE, "completed", {
      correlationId,
      internalOrderId,
      userId: user.$id,
      paymentState: nextPaymentStatus,
      changed: paymentTransition.changed,
      primaryCapture: shouldRunPostPayment,
      duplicateCapture: Boolean(duplicateCapture),
    });

    return NextResponse.json({ ok: true, internalOrderId, paymentState: nextPaymentStatus, orderStatus });
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, message: errorMessage(error) });
    return NextResponse.json({ error: "Failed to verify Razorpay payment.", correlationId }, { status: 500 });
  }
}
