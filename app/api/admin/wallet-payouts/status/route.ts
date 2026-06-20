import { NextResponse } from "next/server";

import { hasVerifiedAdminSession } from "@/lib/firebase/admin-session";
import { updateRefundWalletPayoutStatus } from "@/lib/appwrite/wallet-server";

export const runtime = "nodejs";

function normalize(value: unknown, maxLength = 300): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function redirectWithStatus(returnTo: string, status: string): string {
  const safeReturn = returnTo.startsWith("/admin") ? returnTo : "/admin?tab=refund-wallet";
  const [path, query = ""] = safeReturn.split("?");
  const params = new URLSearchParams(query);
  params.set("walletPayout", status);
  return `${path}?${params.toString()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!(await hasVerifiedAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const payoutRequestId = normalize(formData.get("payoutRequestId"), 80);
  const nextStatusRaw = normalize(formData.get("status"), 40);
  const returnTo = normalize(formData.get("returnTo"), 600) || "/admin?tab=refund-wallet";
  const adminNote = normalize(formData.get("adminNote"), 500);
  const transferReference = normalize(formData.get("transferReference"), 120);

  const nextStatus = nextStatusRaw === "processing" || nextStatusRaw === "paid" || nextStatusRaw === "rejected" || nextStatusRaw === "cancelled"
    ? nextStatusRaw
    : "";

  if (!payoutRequestId || !nextStatus) {
    return NextResponse.redirect(new URL(redirectWithStatus(returnTo, "invalid"), request.url), 303);
  }

  const result = await updateRefundWalletPayoutStatus({
    payoutRequestId,
    nextStatus,
    adminNote,
    transferReference,
  });

  return NextResponse.redirect(
    new URL(redirectWithStatus(returnTo, result.ok ? "success" : result.code), request.url),
    303,
  );
}
