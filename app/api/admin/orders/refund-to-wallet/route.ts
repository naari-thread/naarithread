import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";
import { creditRefundToWallet } from "@/lib/appwrite/wallet-server";

export const runtime = "nodejs";

const ADMIN_GATE_COOKIE = "nt_admin_session";

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

function normalize(value: unknown, maxLength = 300) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function addStatusToReturnUrl(returnTo: string, status: string) {
  const safeReturn = returnTo.startsWith("/admin") ? returnTo : "/admin";
  const [path, query = ""] = safeReturn.split("?");
  const params = new URLSearchParams(query);
  params.set("refund", status);
  return `${path}?${params.toString()}`;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const isAdminSession = Boolean(cookieStore.get(ADMIN_GATE_COOKIE)?.value);
  if (!isAdminSession) {
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

    const creditResult = await creditRefundToWallet({
      databases,
      databaseId,
      userId: orderUserId,
      orderId,
      amount,
      source: `${reason} • ${orderNumber}`,
    });

    const paymentList = await databases.listDocuments(databaseId, paymentsCollectionId, [
      Query.equal("orderId", orderId),
      Query.equal("provider", "razorpay"),
      Query.limit(1),
    ]);

    const paymentDoc = paymentList.documents[0] ?? null;
    await Promise.all([
      databases.updateDocument(databaseId, ordersCollectionId, orderId, {
        status: "refunded_to_wallet",
        paymentStatus: "refunded_to_wallet",
      }),
      paymentDoc
        ? databases.updateDocument(databaseId, paymentsCollectionId, paymentDoc.$id, {
            status: "refunded_to_wallet",
            paymentMeta: JSON.stringify({
              ...(typeof paymentDoc.paymentMeta === "string" ? { previousMeta: paymentDoc.paymentMeta } : {}),
              refundMode: "wallet_credit",
              refundAmount: amount,
              refundReason: reason,
              refundedAt: new Date().toISOString(),
              alreadyCredited: creditResult.alreadyCredited,
            }),
          })
        : Promise.resolve(),
    ]);

    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, creditResult.alreadyCredited ? "duplicate" : "success"), request.url), 303);
  } catch {
    return NextResponse.redirect(new URL(addStatusToReturnUrl(returnTo, "failed"), request.url), 303);
  }
}
