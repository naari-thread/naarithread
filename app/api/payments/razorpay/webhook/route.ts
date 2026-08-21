import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { invalidateAdminTransactionCaches } from "@/lib/firebase/admin-cache";
import { type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
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
  getWebhookSecret,
  mapRazorpayPaymentStatus,
  toOrderStatus,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay-server";

export const runtime = "nodejs";

const SCOPE = "payments.webhook";
const ORDERS_COL = "orders";
const PAYMENTS_COL = "payments";

type RazorpayNotes = { internalOrderId?: string };
type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; status?: string; method?: string; bank?: string; wallet?: string; email?: string; contact?: string; notes?: RazorpayNotes } };
    order?: { entity?: { id?: string; status?: string; notes?: RazorpayNotes } };
  };
};

function normalize(value: unknown, limit = 140): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, limit);
}

function parseMeta(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = normalize(request.headers.get("x-razorpay-event-id"), 64);
  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  try {
    const rawBody = await request.text();
    const webhookSecret = getWebhookSecret();
    const valid = verifyWebhookSignature({ payload: rawBody, signature, webhookSecret });
    if (!valid) {
      log("warn", SCOPE, "signature_invalid", { correlationId, eventId });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const event = normalize(payload.event, 60);
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const internalOrderId =
      normalize(paymentEntity?.notes?.internalOrderId, 64) ||
      normalize(orderEntity?.notes?.internalOrderId, 64);

    log("info", SCOPE, "received", { correlationId, event, eventId, internalOrderId });

    if (!internalOrderId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentId = normalize(paymentEntity?.id, 120);
    const razorpayOrderId = normalize(paymentEntity?.order_id, 80) || normalize(orderEntity?.id, 80);
    const rawStatus = event === "order.paid" ? "captured" : normalize(paymentEntity?.status);
    const incomingState = mapRazorpayPaymentStatus(rawStatus);

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const [paymentSnapshot, order] = await Promise.all([
      databases.getDocument(databaseId, PAYMENTS_COL, internalOrderId).catch(() => null),
      databases.getDocument(databaseId, ORDERS_COL, internalOrderId).catch(() => null),
    ]);

    const paymentMeta = parseMeta(paymentSnapshot?.paymentMeta);
    if (eventId && String(paymentMeta.lastEventId ?? "") === eventId) {
      log("info", SCOPE, "duplicate_event_skipped", { correlationId, event, eventId, internalOrderId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    if (!order) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const currentPaymentStatus = String(paymentSnapshot?.status ?? order.paymentStatus ?? "created");
    const transition = applyPaymentTransition(currentPaymentStatus, incomingState);
    const nextPaymentStatus = transition.next;
    const isPaid = nextPaymentStatus === "paid";
    const baseMeta = {
      ...paymentMeta,
      lastEventId: eventId || String(paymentMeta.lastEventId ?? ""),
      webhookEvent: event,
      razorpayOrderId,
      razorpayPaymentId: paymentId,
      razorpayStatus: paymentEntity?.status ?? (event === "order.paid" ? "paid" : ""),
      method: paymentEntity?.method ?? "",
      bank: paymentEntity?.bank ?? "",
      wallet: paymentEntity?.wallet ?? "",
      email: paymentEntity?.email ?? "",
      contact: paymentEntity?.contact ?? "",
    };

    let orderStatus = toOrderStatus(nextPaymentStatus as never);
    let shouldRunPostPayment = false;
    let duplicateCapture: Awaited<ReturnType<typeof reconcileCapturedPayment>>["duplicateCapture"] = null;

    if (isPaid && paymentId) {
      const razorpay = getRazorpayClient();
      const fullPayment = await razorpay.client.payments.fetch(paymentId);
      const reconciliation = await reconcileCapturedPayment({
        correlationId,
        internalOrderId,
        userId: String(order.userId ?? ""),
        orderStatusWhenPaid: orderStatus,
        razorpayOrderId,
        razorpayPaymentId: paymentId,
        amount: Number(order.totalAmount ?? 0),
        currency: String(fullPayment.currency ?? "INR").toUpperCase() || "INR",
        metaPatch: {
          ...baseMeta,
          razorpayStatus: fullPayment.status,
          method: fullPayment.method,
          bank: fullPayment.bank,
          wallet: fullPayment.wallet,
          email: fullPayment.email,
          contact: fullPayment.contact,
          webhookVerifiedAt: new Date().toISOString(),
        },
      });
      orderStatus = reconciliation.orderStatus;
      shouldRunPostPayment = reconciliation.shouldRunPostPayment;
      duplicateCapture = reconciliation.duplicateCapture;
    } else {
      await databases.createDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, internalOrderId, {
        userId: String(order.userId ?? ""),
        orderId: internalOrderId,
        provider: "razorpay",
        providerPaymentId: paymentId,
        status: nextPaymentStatus,
        amount: Number(order.totalAmount ?? 0),
        currency: "INR",
        paymentMeta: JSON.stringify(baseMeta),
      }).catch(async () => {
        await databases.updateDocument<Models.DefaultDocument>(databaseId, PAYMENTS_COL, internalOrderId, {
          providerPaymentId: paymentId || String(paymentSnapshot?.providerPaymentId ?? ""),
          status: nextPaymentStatus,
          paymentMeta: JSON.stringify(baseMeta),
          ...(paymentSnapshot?.paidAt ? { paidAt: paymentSnapshot.paidAt } : {}),
        });
      });

      if (transition.changed) {
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
    }

    if (event === "payment.failed" && order.userId) {
      createUserNotification({
        userId: String(order.userId),
        title: "Payment Failed",
        body: `Your payment for order ${String(order.orderNumber ?? internalOrderId)} could not be processed. Please retry from your Orders page.`,
        type: "payment",
        metadata: { orderId: internalOrderId },
      }).catch(() => undefined);
    }

    if (duplicateCapture) {
      await refundDuplicateCapturedPayment({
        correlationId,
        internalOrderId,
        orderNumber: String(order.orderNumber ?? internalOrderId),
        userId: String(order.userId ?? ""),
        paymentDocId: internalOrderId,
        duplicateCapture,
      });
    }

    // The admin dashboard caches recent orders/payments; this webhook is the main
    // way they change without an admin action, so refresh them here.
    invalidateAdminTransactionCaches();

    log("info", SCOPE, "processed", {
      correlationId,
      event,
      eventId,
      internalOrderId,
      paymentState: nextPaymentStatus,
      changed: transition.changed,
      primaryCapture: shouldRunPostPayment,
      duplicateCapture: Boolean(duplicateCapture),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, eventId, message: errorMessage(error) });
    return NextResponse.json({ error: "Failed to process Razorpay webhook.", correlationId }, { status: 500 });
  }
}
