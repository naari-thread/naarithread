import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { getUserFromJwt, isAllowedAdminEmail } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const ADMIN_GATE_COOKIE = "nt_admin_session";

function unauthorized(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
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

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_GATE_COOKIE, "1", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return NextResponse.json({ ok: true, email: user.email, name: user.name });
  } catch {
    return unauthorized("Admin session creation failed.");
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_GATE_COOKIE);

  return NextResponse.json({ ok: true });
}
