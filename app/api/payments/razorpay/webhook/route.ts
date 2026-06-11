import { NextResponse } from "next/server";
import { Query, type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import {
  applyPaymentTransition,
  canPaymentUpdateOrderStatus,
  getWebhookSecret,
  mapRazorpayPaymentStatus,
  toOrderStatus,
  verifyWebhookSignature,
} from "@/lib/payments/razorpay-server";

export const runtime = "nodejs";

const SCOPE = "payments.webhook";

type RazorpayNotes = {
  internalOrderId?: string;
};

type RazorpayWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        status?: string;
        method?: string;
        bank?: string;
        wallet?: string;
        email?: string;
        contact?: string;
        notes?: RazorpayNotes;
      };
    };
    order?: {
      entity?: {
        id?: string;
        status?: string;
        notes?: RazorpayNotes;
      };
    };
  };
};

function normalize(value: unknown, limit = 140) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, limit);
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = normalize(request.headers.get("x-razorpay-event-id"), 64);
  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  try {
    // Signature must be computed over the exact raw body — do not parse before this.
    const rawBody = await request.text();
    const webhookSecret = getWebhookSecret();

    const valid = verifyWebhookSignature({
      payload: rawBody,
      signature,
      webhookSecret,
    });

    if (!valid) {
      log("warn", SCOPE, "signature_invalid", { correlationId, eventId });
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    }

    const payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const event = normalize(payload.event, 60);
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;

    // internalOrderId may live on the payment notes (payment.* events) or the
    // order notes (order.paid). Read whichever is present.
    const internalOrderId =
      normalize(paymentEntity?.notes?.internalOrderId, 64) ||
      normalize(orderEntity?.notes?.internalOrderId, 64);

    log("info", SCOPE, "received", { correlationId, event, eventId, internalOrderId });

    if (!internalOrderId) {
      // Unrelated event (e.g. settlement, refund without our notes) — acknowledge.
      return NextResponse.json({ ok: true, ignored: true });
    }

    const paymentId = normalize(paymentEntity?.id, 120);
    const razorpayOrderId = normalize(paymentEntity?.order_id, 80) || normalize(orderEntity?.id, 80);

    // Derive incoming payment state. order.paid implies a captured payment.
    const rawStatus = event === "order.paid" ? "captured" : normalize(paymentEntity?.status);
    const incomingState = mapRazorpayPaymentStatus(rawStatus);

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

    const [paymentsList, order] = await Promise.all([
      databases.listDocuments(databaseId, paymentsCollectionId, [
        Query.equal("orderId", internalOrderId),
        Query.equal("provider", "razorpay"),
        Query.limit(1),
      ]),
      databases.getDocument(databaseId, ordersCollectionId, internalOrderId).catch(() => null),
    ]);

    const paymentDoc = paymentsList.documents[0] ?? null;

    // Idempotency: skip if we have already processed this exact Razorpay event id.
    let previousMeta: Record<string, unknown> = {};
    if (paymentDoc?.paymentMeta) {
      try {
        previousMeta = JSON.parse(String(paymentDoc.paymentMeta)) as Record<string, unknown>;
      } catch {
        previousMeta = {};
      }
    }

    if (eventId && previousMeta.lastEventId === eventId) {
      log("info", SCOPE, "duplicate_event_skipped", { correlationId, event, eventId, internalOrderId });
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const currentPaymentStatus = String(paymentDoc?.status ?? order?.paymentStatus ?? "created");
    const transition = applyPaymentTransition(currentPaymentStatus, incomingState);
    const nextPaymentStatus = transition.next;
    const isPaid = nextPaymentStatus === "paid";

    const writes: Promise<unknown>[] = [];

    if (paymentDoc) {
      // Always record lastEventId (even on no-op) so future replays short-circuit.
      writes.push(
        databases.updateDocument<Models.DefaultDocument>(databaseId, paymentsCollectionId, paymentDoc.$id, {
          providerPaymentId: paymentId || String(paymentDoc.providerPaymentId ?? ""),
          status: nextPaymentStatus,
          paymentMeta: JSON.stringify({
            ...previousMeta,
            lastEventId: eventId || previousMeta.lastEventId || "",
            webhookEvent: event,
            razorpayOrderId,
            razorpayPaymentId: paymentId,
            razorpayStatus: paymentEntity?.status ?? (event === "order.paid" ? "paid" : ""),
            method: paymentEntity?.method ?? "",
            bank: paymentEntity?.bank ?? "",
            wallet: paymentEntity?.wallet ?? "",
            email: paymentEntity?.email ?? "",
            contact: paymentEntity?.contact ?? "",
          }),
          paidAt: isPaid ? new Date().toISOString() : (paymentDoc.paidAt ?? null),
        })
      );
    }

    if (transition.changed && order && canPaymentUpdateOrderStatus(String(order.status ?? ""))) {
      writes.push(
        databases.updateDocument<Models.DefaultDocument>(databaseId, ordersCollectionId, internalOrderId, {
          paymentStatus: nextPaymentStatus,
          status: toOrderStatus(nextPaymentStatus as never),
        })
      );
    }

    if (writes.length > 0) {
      // If any write throws, the catch below returns 500 so Razorpay retries.
      await Promise.all(writes);
    }

    log("info", SCOPE, "processed", {
      correlationId,
      event,
      eventId,
      internalOrderId,
      paymentState: nextPaymentStatus,
      changed: transition.changed,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, eventId, message: errorMessage(error) });
    return NextResponse.json(
      {
        error: "Failed to process Razorpay webhook.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
