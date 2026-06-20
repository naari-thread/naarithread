import { NextResponse } from "next/server";

import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { createRefundWalletPayoutRequest, type WalletPayoutInput } from "@/lib/appwrite/wallet-server";
import { sendRefundWalletPayoutAlert } from "@/lib/email/send";

export const runtime = "nodejs";

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

function parseBody(body: unknown): WalletPayoutInput {
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  return {
    payoutMethod: record.payoutMethod === "bank_transfer" ? "bank_transfer" : "upi",
    accountHolderName: typeof record.accountHolderName === "string" ? record.accountHolderName : "",
    upiId: typeof record.upiId === "string" ? record.upiId : "",
    bankName: typeof record.bankName === "string" ? record.bankName : "",
    bankAccountNumber: typeof record.bankAccountNumber === "string" ? record.bankAccountNumber : "",
    ifscCode: typeof record.ifscCode === "string" ? record.ifscCode : "",
    note: typeof record.note === "string" ? record.note : "",
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const [body, user] = await Promise.all([request.json(), getUserFromJwt(token)]);
    const payoutInput = parseBody(body);
    const result = await createRefundWalletPayoutRequest({
      userId: user.$id,
      customerName: user.name ?? "Customer",
      customerEmail: user.email ?? "",
      input: payoutInput,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message, code: result.code }, { status: 400 });
    }

    await sendRefundWalletPayoutAlert({
      requestNumber: result.requestNumber,
      amount: result.amount,
      customerName: user.name ?? "Customer",
      customerEmail: user.email ?? "",
      payoutMethod: payoutInput.payoutMethod,
      accountHolderName: payoutInput.accountHolderName,
      upiId: payoutInput.upiId,
      bankName: payoutInput.bankName,
      bankAccountNumber: payoutInput.bankAccountNumber,
      ifscCode: payoutInput.ifscCode,
      note: payoutInput.note,
    });

    return NextResponse.json({
      ok: true,
      requestId: result.requestId,
      requestNumber: result.requestNumber,
      amount: result.amount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create Refund Wallet transfer request.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
