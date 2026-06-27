import { NextResponse } from "next/server";

import { verifyFirebaseIdToken } from "@/lib/firebase/admin-auth";
import { approveLoginSession } from "@/lib/firebase/login-sessions";

export const runtime = "nodejs";

/**
 * Called by the device that opened the email link (e.g. phone) AFTER it has
 * completed `signInWithEmailLink`. The Firebase ID token proves the caller
 * owns the email, which is what authorizes approving the laptop's session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { sessionId?: unknown; idToken?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const idToken = typeof body.idToken === "string" ? body.idToken : "";

    if (!sessionId || !idToken) {
      return NextResponse.json({ error: "Missing session or token." }, { status: 400 });
    }

    const decoded = await verifyFirebaseIdToken(idToken);
    const email = decoded.email ?? "";
    if (!email) {
      return NextResponse.json({ error: "Verified account has no email." }, { status: 401 });
    }

    await approveLoginSession(sessionId, decoded.uid, email);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve sign-in.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
