import { NextResponse } from "next/server";
import { ID, Permission, Role, type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { sendOrderStatusEmail } from "@/lib/email/send";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { invalidateAdminTransactionCaches } from "@/lib/firebase/admin-cache";

export const runtime = "nodejs";

const SCOPE = "admin.orders.status";
const ORDERS_COL = "orders";
const NOTIFICATIONS_COL = "notifications";

const FULFILLMENT_FLOW = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered", "completed"] as const;
const TERMINAL_STATUSES = new Set(["delivered", "completed", "cancelled", "refunded_to_wallet"]);
const ALLOWED_TARGETS = new Set<string>([...FULFILLMENT_FLOW.slice(1), "cancelled"]);

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Order confirmed",
  shipped: "Order shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Order delivered",
  completed: "Order completed",
  cancelled: "Order cancelled",
};

function normalize(value: unknown, maxLength = 64) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function addStatusToReturnUrl(returnTo: string, status: string) {
  const safeReturn = returnTo.startsWith("/admin") ? returnTo : "/admin";
  const [path, query = ""] = safeReturn.split("?");
  const params = new URLSearchParams(query);
  params.set("orderStatus", status);
  return `${path}?${params.toString()}`;
}

function isValidTransition(current: string, target: string) {
  if (!ALLOWED_TARGETS.has(target)) return false;
  if (target === "cancelled") return !TERMINAL_STATUSES.has(current);
  const currentIndex = FULFILLMENT_FLOW.indexOf(current as (typeof FULFILLMENT_FLOW)[number]);
  const targetIndex = FULFILLMENT_FLOW.indexOf(target as (typeof FULFILLMENT_FLOW)[number]);
  return currentIndex >= 0 && targetIndex > currentIndex;
}

export async function POST(request: Request): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const orderId = normalize(formData.get("orderId"), 64);
  const target = normalize(formData.get("status"), 40).toLowerCase();
  const returnTo = normalize(formData.get("returnTo"), 600) || "/admin?tab=orders";

  if (!orderId || !target) {
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "missing"), request.url), 303);
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const order = await databases.getDocument(databaseId, ORDERS_COL, orderId);
    const currentStatus = String(order.status ?? "").trim().toLowerCase();

    if (!isValidTransition(currentStatus, target)) {
      log("warn", SCOPE, "invalid_transition", { correlationId, orderId, currentStatus, target });
      return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "invalid"), request.url), 303);
    }

    await databases.updateDocument<Models.DefaultDocument>(databaseId, ORDERS_COL, orderId, { status: target });

    const userId = String(order.userId ?? "").trim();
    const userEmail = String(order.userEmail ?? "").trim();
    const orderNumber = String(order.orderNumber ?? order.$id);
    const totalAmount = Number(order.totalAmount ?? 0);

    // Extract customer name from shipping address
    let customerName = "";
    try {
      const shipping = JSON.parse(String(order.shippingAddress ?? "{}")) as { fullName?: string };
      customerName = shipping.fullName ?? "";
    } catch { /* ignore */ }

    // Extract line items from itemsJson
    type RawLine = { productName?: string; quantity?: number; size?: string; color?: string; lineAmount?: number };
    let lines: Array<{ productName: string; quantity: number; size?: string; color?: string; lineAmount: number }> = [];
    try {
      const raw = JSON.parse(String(order.itemsJson ?? "[]")) as RawLine[];
      lines = raw.map((l) => ({
        productName: String(l.productName ?? ""),
        quantity: Number(l.quantity ?? 1),
        size: l.size ? String(l.size) : undefined,
        color: l.color ? String(l.color) : undefined,
        lineAmount: Number(l.lineAmount ?? 0),
      }));
    } catch { /* ignore */ }

    // Await delivery before returning so Vercel cannot freeze the function early.
    if (userEmail) {
      await sendOrderStatusEmail(userEmail, {
        customerName,
        customerEmail: userEmail,
        orderNumber,
        status: target,
        total: totalAmount,
        lines,
      });
    }

    // Best-effort in-app notification
    if (userId) {
      try {
        await databases.createDocument(
          databaseId,
          NOTIFICATIONS_COL,
          ID.unique(),
          {
            userId,
            title: STATUS_LABELS[target] ?? "Order update",
            body: `Your order ${orderNumber} is now ${target.replace(/_/g, " ")}.`,
            type: "order",
            isRead: false,
            metadata: JSON.stringify({ orderId, status: target }),
            sentAt: new Date().toISOString(),
          },
          [Permission.read(Role.user(userId)), Permission.update(Role.user(userId))]
        );
      } catch (notifyError) {
        log("warn", SCOPE, "notification_failed", { correlationId, orderId, message: errorMessage(notifyError) });
      }
    }

    invalidateAdminTransactionCaches();
    log("info", SCOPE, "updated", { correlationId, orderId, from: currentStatus, to: target });
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "success"), request.url), 303);
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, orderId, message: errorMessage(error) });
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "failed"), request.url), 303);
  }
}
