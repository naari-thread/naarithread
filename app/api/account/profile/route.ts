import { NextResponse } from "next/server";

import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { resolveUserProfile } from "@/lib/appwrite/user-profile-server";

export const runtime = "nodejs";

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

/**
 * Read the canonical profile (Admin SDK). Self-heals legacy/duplicate rows so
 * the user always maps to a single users/{uid} document.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const jwt = getBearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const profile = await resolveUserProfile(user);
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[account-profile] read failed", error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

/** Update profile fields (Admin SDK), applied to the canonical users/{uid} doc. */
export async function PUT(request: Request): Promise<NextResponse> {
  const jwt = getBearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const body = (await request.json()) as { fullName?: unknown; phone?: unknown; address?: unknown };

    const profile = await resolveUserProfile(user, {
      ...(typeof body.fullName === "string" ? { fullName: body.fullName } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
      ...(typeof body.address === "string" ? { address: body.address } : {}),
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[account-profile] update failed", error);
    return NextResponse.json({ error: "Unable to save profile." }, { status: 500 });
  }
}
