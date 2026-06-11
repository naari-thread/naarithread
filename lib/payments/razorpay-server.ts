import crypto from "node:crypto";

import Razorpay from "razorpay";

function mustEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getRazorpayClient() {
  const keyId = mustEnv("RAZORPAY_KEY_ID");
  const keySecret = mustEnv("RAZORPAY_KEY_SECRET");

  return {
    keyId,
    keySecret,
    client: new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    }),
  };
}

export function getWebhookSecret() {
  return mustEnv("RAZORPAY_WEBHOOK_SECRET");
}

export function toPaise(amountInMajor: number) {
  return Math.max(0, Math.round(amountInMajor * 100));
}

function safeEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function createPaymentSignature(orderId: string, paymentId: string, keySecret: string) {
  return crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function verifyCheckoutSignature(args: {
  orderId: string;
  paymentId: string;
  signature: string;
  keySecret: string;
}) {
  const expected = createPaymentSignature(args.orderId, args.paymentId, args.keySecret);
  return safeEqual(expected, args.signature);
}

export function verifyWebhookSignature(args: {
  payload: string;
  signature: string;
  webhookSecret: string;
}) {
  const expected = crypto.createHmac("sha256", args.webhookSecret).update(args.payload).digest("hex");
  return safeEqual(expected, args.signature);
}

export type InternalPaymentState = "created" | "authorized" | "paid" | "failed";

export function mapRazorpayPaymentStatus(status: string): InternalPaymentState {
  const normalized = status.trim().toLowerCase();

  if (normalized === "captured") {
    return "paid";
  }

  if (normalized === "authorized") {
    return "authorized";
  }

  if (normalized === "failed") {
    return "failed";
  }

  return "created";
}

export function toOrderStatus(paymentState: InternalPaymentState) {
  if (paymentState === "paid") {
    return "placed";
  }

  if (paymentState === "failed") {
    return "payment_failed";
  }

  return "payment_pending";
}

// Forward-only ranking for payment progression. Webhooks can arrive out of order
// and be retried, so we never downgrade (e.g. a late "authorized" must not undo "paid").
const PAYMENT_FORWARD_RANK: Record<string, number> = {
  failed: -1,
  created: 0,
  authorized: 1,
  paid: 2,
};

export function isTerminalPaymentStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === "paid" || normalized.startsWith("refunded");
}

/**
 * Decides whether an incoming payment state should be applied over the currently
 * stored one. Guards against duplicate webhook/verify deliveries and out-of-order
 * events. Returns the value to persist when `changed` is true.
 */
export function applyPaymentTransition(
  currentStatus: string,
  incoming: InternalPaymentState
): { changed: boolean; next: string } {
  const current = currentStatus.trim().toLowerCase();

  // Terminal states are never moved by payment events (refunds are handled elsewhere).
  if (current === "paid" || current.startsWith("refunded")) {
    return { changed: false, next: currentStatus };
  }

  if (incoming === "failed") {
    if (current === "failed") {
      return { changed: false, next: currentStatus };
    }
    return { changed: true, next: "failed" };
  }

  const currentRank = PAYMENT_FORWARD_RANK[current] ?? 0;
  const incomingRank = PAYMENT_FORWARD_RANK[incoming] ?? 0;

  if (incomingRank > currentRank) {
    return { changed: true, next: incoming };
  }

  return { changed: false, next: currentStatus };
}

// Order statuses that the payment flow is allowed to set. Anything else
// (confirmed/shipped/delivered/cancelled/refunded_*) is owned by the admin
// fulfillment workflow and must not be overwritten by late payment events.
const PAYMENT_OWNED_ORDER_STATUSES = new Set([
  "initiated",
  "payment_pending",
  "payment_failed",
  "placed",
]);

export function canPaymentUpdateOrderStatus(currentOrderStatus: string) {
  return PAYMENT_OWNED_ORDER_STATUSES.has(currentOrderStatus.trim().toLowerCase());
}
