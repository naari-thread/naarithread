import { type DocumentReference, type Transaction } from "firebase-admin/firestore";

import { createUserNotification } from "@/lib/appwrite/notifications";
import { timestampToIso } from "@/lib/firebase/document";
import { getAdminDb } from "@/lib/firebase/admin";
import { errorMessage, log } from "@/lib/logger";
import { createIdempotentRefund } from "@/lib/payments/razorpay-server";

const SCOPE = "payments.reconciliation";
const ORDERS_COLLECTION = "orders";
const PAYMENTS_COLLECTION = "payments";

export type DuplicateCaptureRecord = {
  paymentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
  detectedAt: string;
  refundStatus: "pending" | "processed" | "failed";
  refundId: string;
  refundReceipt: string;
  refundedAt: string;
  refundError: string;
};

type PaymentMetaRecord = {
  primaryPaymentId?: string;
  primaryRazorpayOrderId?: string;
  duplicateCaptures?: DuplicateCaptureRecord[];
  [key: string]: unknown;
};

type OrderRecord = {
  userId?: unknown;
  paymentStatus?: unknown;
  status?: unknown;
  primaryPaymentId?: unknown;
  paidAt?: unknown;
};

type PaymentRecord = {
  userId?: unknown;
  orderId?: unknown;
  provider?: unknown;
  providerPaymentId?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  paymentMeta?: unknown;
  paidAt?: unknown;
};

type ReconcileCapturedPaymentArgs = {
  correlationId: string;
  internalOrderId: string;
  userId: string;
  orderStatusWhenPaid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amount: number;
  currency: string;
  metaPatch: Record<string, unknown>;
};

export type ReconcileCapturedPaymentResult = {
  paymentDocId: string;
  paymentState: "paid";
  orderStatus: string;
  isPrimaryCapture: boolean;
  shouldRunPostPayment: boolean;
  duplicateCapture: DuplicateCaptureRecord | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toText(value: unknown, max = 300): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePaymentMeta(value: unknown): PaymentMetaRecord {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeDuplicateCaptures(value: unknown): DuplicateCaptureRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): DuplicateCaptureRecord[] => {
    if (!isRecord(entry)) {
      return [];
    }

    const paymentId = toText(entry.paymentId, 120);
    if (!paymentId) {
      return [];
    }

    return [{
      paymentId,
      razorpayOrderId: toText(entry.razorpayOrderId, 80),
      amount: Math.max(0, toNumber(entry.amount)),
      currency: toText(entry.currency, 16) || "INR",
      detectedAt: toText(entry.detectedAt, 80),
      refundStatus: (toText(entry.refundStatus, 20) as DuplicateCaptureRecord["refundStatus"]) || "pending",
      refundId: toText(entry.refundId, 80),
      refundReceipt: toText(entry.refundReceipt, 120),
      refundedAt: toText(entry.refundedAt, 80),
      refundError: toText(entry.refundError, 400),
    }];
  });
}

function upsertDuplicateCaptureRecord(records: DuplicateCaptureRecord[], nextRecord: DuplicateCaptureRecord): DuplicateCaptureRecord[] {
  const index = records.findIndex((record) => record.paymentId === nextRecord.paymentId);
  if (index === -1) {
    return [...records, nextRecord];
  }

  return records.map((record, recordIndex) => {
    if (recordIndex !== index) {
      return record;
    }

    return {
      ...record,
      ...nextRecord,
      refundStatus: nextRecord.refundStatus || record.refundStatus,
      refundId: nextRecord.refundId || record.refundId,
      refundReceipt: nextRecord.refundReceipt || record.refundReceipt,
      refundedAt: nextRecord.refundedAt || record.refundedAt,
      refundError: nextRecord.refundError || record.refundError,
    };
  });
}

function paymentDocRef(internalOrderId: string): DocumentReference {
  return getAdminDb().collection(PAYMENTS_COLLECTION).doc(internalOrderId);
}

function orderDocRef(internalOrderId: string): DocumentReference {
  return getAdminDb().collection(ORDERS_COLLECTION).doc(internalOrderId);
}

function buildNextPrimaryMeta(meta: PaymentMetaRecord, args: ReconcileCapturedPaymentArgs): PaymentMetaRecord {
  return {
    ...meta,
    ...args.metaPatch,
    primaryPaymentId: args.razorpayPaymentId,
    primaryRazorpayOrderId: args.razorpayOrderId,
  };
}

export async function reconcileCapturedPayment(args: ReconcileCapturedPaymentArgs): Promise<ReconcileCapturedPaymentResult> {
  const db = getAdminDb();
  const orderRef = orderDocRef(args.internalOrderId);
  const paymentRef = paymentDocRef(args.internalOrderId);

  return db.runTransaction(async (transaction: Transaction) => {
    const [orderSnapshot, paymentSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(paymentRef),
    ]);

    if (!orderSnapshot.exists) {
      throw new Error("Order not found for payment reconciliation.");
    }

    const nowIso = new Date().toISOString();
    const order = (orderSnapshot.data() ?? {}) as OrderRecord;
    const payment = (paymentSnapshot.data() ?? {}) as PaymentRecord;
    const parsedMeta = parsePaymentMeta(payment.paymentMeta);
    const duplicateCaptures = normalizeDuplicateCaptures(parsedMeta.duplicateCaptures);
    const primaryPaymentId =
      toText(order.primaryPaymentId, 120) ||
      toText(parsedMeta.primaryPaymentId, 120) ||
      (toText(payment.status, 40).toLowerCase() === "paid" ? toText(payment.providerPaymentId, 120) : "");

    if (primaryPaymentId && primaryPaymentId !== args.razorpayPaymentId) {
      const previousRecord = duplicateCaptures.find((record) => record.paymentId === args.razorpayPaymentId);
      const duplicateCapture: DuplicateCaptureRecord = {
        paymentId: args.razorpayPaymentId,
        razorpayOrderId: args.razorpayOrderId,
        amount: Math.max(0, args.amount),
        currency: args.currency,
        detectedAt: previousRecord?.detectedAt || nowIso,
        refundStatus: previousRecord?.refundStatus || "pending",
        refundId: previousRecord?.refundId || "",
        refundReceipt: previousRecord?.refundReceipt || "",
        refundedAt: previousRecord?.refundedAt || "",
        refundError: previousRecord?.refundError || "",
      };

      const nextMeta = {
        ...parsedMeta,
        ...args.metaPatch,
        duplicateCaptures: upsertDuplicateCaptureRecord(duplicateCaptures, duplicateCapture),
      };

      transaction.set(paymentRef, {
        ...(!paymentSnapshot.exists ? { createdAt: nowIso } : {}),
        updatedAt: nowIso,
        userId: args.userId,
        orderId: args.internalOrderId,
        provider: "razorpay",
        providerPaymentId: primaryPaymentId || toText(payment.providerPaymentId, 120),
        status: "paid",
        amount: Math.max(0, args.amount),
        currency: args.currency,
        paymentMeta: JSON.stringify(nextMeta),
        paidAt: timestampToIso(payment.paidAt) || timestampToIso(order.paidAt) || nowIso,
      }, { merge: true });

      transaction.update(orderRef, {
        duplicatePaymentDetectedAt: nowIso,
        duplicatePaymentCount: upsertDuplicateCaptureRecord(duplicateCaptures, duplicateCapture).length,
      });

      return {
        paymentDocId: paymentRef.id,
        paymentState: "paid",
        orderStatus: toText(order.status, 60) || args.orderStatusWhenPaid,
        isPrimaryCapture: false,
        shouldRunPostPayment: false,
        duplicateCapture,
      };
    }

    const nextMeta = buildNextPrimaryMeta(parsedMeta, args);
    const shouldRunPostPayment = toText(order.paymentStatus, 40).toLowerCase() !== "paid";

    transaction.set(paymentRef, {
      ...(!paymentSnapshot.exists ? { createdAt: nowIso } : {}),
      updatedAt: nowIso,
      userId: args.userId,
      orderId: args.internalOrderId,
      provider: "razorpay",
      providerPaymentId: args.razorpayPaymentId,
      status: "paid",
      amount: Math.max(0, args.amount),
      currency: args.currency,
      paymentMeta: JSON.stringify(nextMeta),
      paidAt: nowIso,
    }, { merge: true });

    transaction.update(orderRef, {
      paymentStatus: "paid",
      status: args.orderStatusWhenPaid,
      primaryPaymentId: args.razorpayPaymentId,
      paidAt: nowIso,
    });

    return {
      paymentDocId: paymentRef.id,
      paymentState: "paid",
      orderStatus: args.orderStatusWhenPaid,
      isPrimaryCapture: true,
      shouldRunPostPayment,
      duplicateCapture: null,
    };
  });
}

export async function refundDuplicateCapturedPayment(args: {
  correlationId: string;
  internalOrderId: string;
  orderNumber: string;
  userId: string;
  paymentDocId: string;
  duplicateCapture: DuplicateCaptureRecord;
}): Promise<void> {
  if (args.duplicateCapture.refundStatus === "processed") {
    return;
  }

  const receipt = `dup-${args.internalOrderId}-${args.duplicateCapture.paymentId}`.slice(0, 40);
  const idempotencyKey = `duprefund-${args.internalOrderId}-${args.duplicateCapture.paymentId}`.slice(0, 80);

  try {
    const refund = await createIdempotentRefund({
      paymentId: args.duplicateCapture.paymentId,
      amountInPaise: Math.round(args.duplicateCapture.amount * 100),
      receipt,
      idempotencyKey,
      notes: {
        internalOrderId: args.internalOrderId,
        orderNumber: args.orderNumber,
        reason: "duplicate_capture_auto_refund",
      },
    });

    const db = getAdminDb();
    const paymentRef = paymentDocRef(args.internalOrderId);
    const orderRef = orderDocRef(args.internalOrderId);
    await db.runTransaction(async (transaction: Transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      const payment = (paymentSnapshot.data() ?? {}) as PaymentRecord;
      const parsedMeta = parsePaymentMeta(payment.paymentMeta);
      const duplicateCaptures = normalizeDuplicateCaptures(parsedMeta.duplicateCaptures);

      transaction.set(paymentRef, {
        paymentMeta: JSON.stringify({
          ...parsedMeta,
          duplicateCaptures: upsertDuplicateCaptureRecord(duplicateCaptures, {
            ...args.duplicateCapture,
            refundStatus: "processed",
            refundId: refund.id,
            refundReceipt: refund.receipt || receipt,
            refundedAt: refund.createdAt || new Date().toISOString(),
            refundError: "",
          }),
        }),
      }, { merge: true });
      transaction.set(orderRef, {
        duplicatePaymentRefundedAt: refund.createdAt || new Date().toISOString(),
      }, { merge: true });
    });

    await createUserNotification({
      userId: args.userId,
      title: "Duplicate payment refund initiated",
      body: `A duplicate payment attempt for order ${args.orderNumber} was detected and refunded automatically to the original payment source.`,
      type: "payment",
      metadata: {
        orderId: args.internalOrderId,
        refundId: refund.id,
        duplicatePaymentId: args.duplicateCapture.paymentId,
      },
    }).catch(() => undefined);
  } catch (error) {
    log("error", SCOPE, "duplicate_refund_failed", {
      correlationId: args.correlationId,
      internalOrderId: args.internalOrderId,
      duplicatePaymentId: args.duplicateCapture.paymentId,
      message: errorMessage(error),
    });

    const db = getAdminDb();
    const paymentRef = paymentDocRef(args.internalOrderId);
    await db.runTransaction(async (transaction: Transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      const payment = (paymentSnapshot.data() ?? {}) as PaymentRecord;
      const parsedMeta = parsePaymentMeta(payment.paymentMeta);
      const duplicateCaptures = normalizeDuplicateCaptures(parsedMeta.duplicateCaptures);

      transaction.set(paymentRef, {
        paymentMeta: JSON.stringify({
          ...parsedMeta,
          duplicateCaptures: upsertDuplicateCaptureRecord(duplicateCaptures, {
            ...args.duplicateCapture,
            refundStatus: "failed",
            refundError: errorMessage(error).slice(0, 400),
          }),
        }),
      }, { merge: true });
    });
  }
}
