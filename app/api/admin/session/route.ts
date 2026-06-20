import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getUserFromJwt, isAllowedAdminEmail } from "@/lib/appwrite/admin-server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionCookie,
} from "@/lib/firebase/admin-session";

export const runtime = "nodejs";

function unauthorized(message: string, status = 401): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    return unauthorized("Missing bearer token.");
  }

  try {
    const user = await getUserFromJwt(token);

    if (!user.email || !isAllowedAdminEmail(user.email)) {
      return unauthorized("This account is not allowed for admin actions.", 403);
    }

    const sessionCookie = await createAdminSessionCookie(token);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ ok: true, email: user.email, name: user.name });
  } catch {
    return unauthorized("Admin session creation failed.");
  }
}

export async function DELETE(): Promise<NextResponse> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);

  return NextResponse.json({ ok: true });
}
