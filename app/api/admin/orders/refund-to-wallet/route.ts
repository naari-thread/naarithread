import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { createUserNotification } from "@/lib/appwrite/notifications";
import { creditRefundToWallet } from "@/lib/appwrite/wallet-server";
import { sendOrderStatusEmail } from "@/lib/email/send";
import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { invalidateAdminTransactionCaches } from "@/lib/firebase/admin-cache";

export const runtime = "nodejs";

const ORDERS_COL = "orders";
const PAYMENTS_COL = "payments";

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normalize(value: unknown, maxLength = 300): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function addStatusToReturnUrl(returnTo: string, status: string): string {
  const safeReturn = returnTo.startsWith("/admin") ? returnTo : "/admin";
  const [path, query = ""] = safeReturn.split("?");
  const params = new URLSearchParams(query);
  params.set("refund", status);
  return `${path}?${params.toString()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const orderId = normalize(formData.get("orderId"), 64);
  const returnTo = normalize(formData.get("returnTo"), 600) || "/admin?tab=orders";
  const reason = normalize(formData.get("reason"), 300) || "Admin approved refund";

  if (!orderId) {
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "missing-order"), request.url), 303);
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const order = await databases.getDocument(databaseId, ORDERS_COL, orderId);
    const orderUserId = String(order.userId ?? "").trim();
    const orderNumber = String(order.orderNumber ?? order.$id).trim();
    const amount = Math.max(0, toNumber(order.totalAmount));
    const paymentStatus = String(order.paymentStatus ?? "").toLowerCase();

    if (!orderUserId || amount <= 0) {
      return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "invalid-order"), request.url), 303);
    }
    if (paymentStatus !== "paid") {
      return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "not-paid"), request.url), 303);
    }

    const userEmail = String(order.userEmail ?? "").trim().toLowerCase();
    let customerName = "Customer";
    try {
      const addr = typeof order.shippingAddress === "string" ? JSON.parse(order.shippingAddress) as Record<string, unknown> : {};
      customerName = String(addr.fullName ?? "Customer").trim() || "Customer";
    } catch { /* ignore parse errors */ }

    const creditResult = await creditRefundToWallet({
      userId: orderUserId,
      orderId,
      amount,
      source: `${reason} - ${orderNumber}`,
    });

    if (!creditResult.alreadyCredited && userEmail) {
      await Promise.all([
        createUserNotification({
          userId: orderUserId,
          title: "Refund added to your wallet",
          body: `₹${amount.toLocaleString("en-IN")} for order ${orderNumber} has been credited to your Refund Wallet. It will be eligible for transfer after 7 days.`,
          type: "wallet",
          metadata: { orderId, orderNumber, amount },
        }).catch(() => undefined),
        sendOrderStatusEmail(userEmail, {
          customerName,
          customerEmail: userEmail,
          orderNumber,
          status: "refunded_to_wallet",
          total: amount,
        }).catch(() => undefined),
      ]);
    }

    const paymentList = await databases.listDocuments(databaseId, PAYMENTS_COL, [
      Query.equal("orderId", orderId),
      Query.equal("provider", "razorpay"),
      Query.limit(1),
    ]);

    const paymentDoc = paymentList.documents[0] ?? null;
    await Promise.all([
      databases.updateDocument(databaseId, ORDERS_COL, orderId, { status: "refunded_to_wallet", paymentStatus: "refunded_to_wallet" }),
      paymentDoc
        ? databases.updateDocument(databaseId, PAYMENTS_COL, paymentDoc.$id, {
            status: "refunded_to_wallet",
            paymentMeta: JSON.stringify({
              ...(typeof paymentDoc.paymentMeta === "string" ? { previousMeta: paymentDoc.paymentMeta } : {}),
              refundMode: "refund_wallet_credit",
              refundAmount: amount,
              refundReason: reason,
              refundedAt: new Date().toISOString(),
              alreadyCredited: creditResult.alreadyCredited,
            }),
          })
        : Promise.resolve(),
    ]);

    invalidateAdminTransactionCaches();
    return NextResponse.redirect(
      new URL(addStatusToReturnUrl(returnTo, creditResult.alreadyCredited ? "duplicate" : "success"), request.url),
      303,
    );
  } catch {
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "failed"), request.url), 303);
  }
}
