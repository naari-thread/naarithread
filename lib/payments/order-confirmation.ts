import { FieldValue } from "firebase-admin/firestore";

import { sendOrderConfirmation } from "@/lib/email/send";
import type { OrderConfirmationData } from "@/lib/email/templates";
import { getAdminDb } from "@/lib/firebase/admin";

const ZONE_E_STATES = new Set([
  "arunachal pradesh", "assam", "manipur", "meghalaya", "mizoram",
  "nagaland", "sikkim", "tripura", "jammu and kashmir", "ladakh",
  "andaman and nicobar islands", "andaman & nicobar islands", "lakshadweep",
]);

const NEAR_STATES = new Set([
  "gujarat", "maharashtra", "rajasthan", "madhya pradesh", "goa",
  "daman and diu", "dadra and nagar haveli", "dadra & nagar haveli",
]);

function estimateDeliveryDays(state: string): string {
  const s = state.toLowerCase().trim();
  if (ZONE_E_STATES.has(s)) return "4–5";
  if (NEAR_STATES.has(s)) return "1–2";
  return "2–4";
}

const ORDERS_COLLECTION = "orders";

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function lockExpiredAt(value: unknown): boolean {
  const iso = typeof value === "string" ? value.trim() : "";
  if (!iso) {
    return true;
  }

  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return true;
  }

  return Date.now() - timestamp > 15 * 60 * 1000;
}

function parseLines(value: unknown): OrderConfirmationData["lines"] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): OrderConfirmationData["lines"] => {
      if (!entry || typeof entry !== "object") return [];
      const line = entry as Record<string, unknown>;
      return [{
        productName: String(line.productName ?? "Product"),
        quantity: Math.max(1, Math.trunc(toNumber(line.quantity) || 1)),
        size: String(line.size ?? "").trim() || undefined,
        color: String(line.color ?? "").trim() || undefined,
        lineAmount: toNumber(line.lineAmount),
      }];
    });
  } catch {
    return [];
  }
}

function buildConfirmationData(order: Record<string, unknown>): OrderConfirmationData {
  const address = parseObject(order.shippingAddress);
  const lines = parseLines(order.itemsJson);
  const subtotalFromLines = lines.reduce((sum, line) => sum + line.lineAmount, 0);
  const totalDiscount = toNumber(order.discountAmount);
  const productDiscount = toNumber(order.productDiscountAmount) || totalDiscount;

  const stateStr = String(address.state ?? "");

  return {
    customerName: String(address.fullName ?? "Customer"),
    orderNumber: String(order.orderNumber ?? "Order"),
    lines,
    subtotal: toNumber(order.subtotalAmount) || subtotalFromLines + productDiscount,
    delivery: toNumber(order.shippingAmount),
    discount: productDiscount,
    couponDiscount: toNumber(order.couponDiscountAmount),
    total: toNumber(order.totalAmount),
    address: {
      fullName: String(address.fullName ?? "Customer"),
      phone: String(address.phone ?? ""),
      houseNo: String(address.houseNo ?? ""),
      locality: String(address.locality ?? ""),
      landmark: String(address.landmark ?? ""),
      city: String(address.city ?? ""),
      state: stateStr,
      postalCode: String(address.postalCode ?? ""),
      country: String(address.country ?? "India"),
    },
    deliveryDays: stateStr ? estimateDeliveryDays(stateStr) : undefined,
  };
}

export async function sendPaidOrderConfirmationOnce(orderId: string): Promise<boolean> {
  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) return false;

  const db = getAdminDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(normalizedOrderId);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists) return false;

  const order = orderSnapshot.data() ?? {};
  if (String(order.paymentStatus ?? "").toLowerCase() !== "paid" || order.confirmationEmailSentAt) {
    return false;
  }

  const recipient = String(order.userEmail ?? "").trim().toLowerCase();
  if (!recipient) return false;

  const lockAcquired = await db.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(orderRef);
    if (!currentSnapshot.exists) {
      return false;
    }

    const current = currentSnapshot.data() ?? {};
    if (current.confirmationEmailSentAt) {
      return false;
    }
    if (current.confirmationEmailLockAt && !lockExpiredAt(current.confirmationEmailLockAt)) {
      return false;
    }

    transaction.update(orderRef, {
      confirmationEmailLockAt: new Date().toISOString(),
    });
    return true;
  });

  if (!lockAcquired) {
    return false;
  }

  const emailId = await sendOrderConfirmation(
    recipient,
    buildConfirmationData(order),
    `order-confirmation/${normalizedOrderId}`,
  );
  if (!emailId) {
    await orderRef.update({
      confirmationEmailLockAt: FieldValue.delete(),
    });
    return false;
  }

  await orderRef.update({
    confirmationEmailId: emailId,
    confirmationEmailSentAt: FieldValue.serverTimestamp(),
    confirmationEmailLockAt: FieldValue.delete(),
  });

  return true;
}
