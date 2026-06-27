import { NextResponse } from "next/server";

import { getAdminAuth } from "@/lib/firebase/admin-auth";
import { consumeApprovedSession } from "@/lib/firebase/login-sessions";

export const runtime = "nodejs";

/**
 * Polled by the originating device (laptop). When the session has been
 * approved on another device, and the caller proves it holds the `pollSecret`,
 * we mint a one-time Firebase custom token so the laptop can sign itself in.
 * The token is never persisted or exposed to the approving device.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { sessionId?: unknown; pollSecret?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const pollSecret = typeof body.pollSecret === "string" ? body.pollSecret : "";

    if (!sessionId || !pollSecret) {
      return NextResponse.json({ status: "denied" }, { status: 400 });
    }

    const result = await consumeApprovedSession(sessionId, pollSecret);

    if (result.status === "approved") {
      const customToken = await getAdminAuth().createCustomToken(result.uid);
      return NextResponse.json({ status: "approved", customToken });
    }

    return NextResponse.json({ status: result.status });
  } catch {
    return NextResponse.json({ status: "denied" }, { status: 500 });
  }
}
