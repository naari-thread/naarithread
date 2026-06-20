import { NextResponse } from "next/server";

import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { listWalletSummary } from "@/lib/appwrite/wallet-server";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(token);
    const wallet = await listWalletSummary({ userId: user.$id });

    return NextResponse.json(wallet);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load wallet details.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
