import { NextResponse } from "next/server";

import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { resolveUserProfile } from "@/lib/appwrite/user-profile-server";

export const runtime = "nodejs";

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

/**
 * Called on every sign-in. Ensures the canonical users/{uid} profile exists and
 * folds away any legacy/duplicate rows for this user (see resolveUserProfile).
 */
export async function POST(request: Request) {
  const jwt = getBearerToken(request);
  if (!jwt) {
    console.warn("[auth-profile-api] missing bearer token");
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const profile = await resolveUserProfile(user);
    return NextResponse.json({ ok: true, profileId: profile.$id });
  } catch (error) {
    console.error("[auth-profile-api] sync failed", { error });
    return NextResponse.json(
      {
        error: "Failed to sync user profile.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
