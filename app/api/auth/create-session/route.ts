import { NextResponse } from "next/server";

import { createLoginSession } from "@/lib/firebase/login-sessions";

export const runtime = "nodejs";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Starts a cross-device login session. Called by the originating device
 * (e.g. laptop) before it sends the Firebase email link. No auth required —
 * the email link itself (and email ownership) is the real authentication gate.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!emailPattern.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const { sessionId, pollSecret } = await createLoginSession(email);
    return NextResponse.json({ sessionId, pollSecret });
  } catch {
    return NextResponse.json({ error: "Could not start sign-in. Please try again." }, { status: 500 });
  }
}
