import "server-only";

import { cookies } from "next/headers";
import type { DecodedIdToken } from "firebase-admin/auth";

import { getAdminAuth, getServerAdminEmails } from "@/lib/firebase/admin";

export const ADMIN_SESSION_COOKIE = "nt_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function isAllowedAdminToken(token: DecodedIdToken): boolean {
  const email = token.email?.trim().toLowerCase() ?? "";
  return Boolean(email) && getServerAdminEmails().includes(email);
}

export async function createAdminSessionCookie(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export async function getVerifiedAdminSession(): Promise<DecodedIdToken | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(ADMIN_SESSION_COOKIE)?.value ?? "";
  if (!sessionCookie) return null;

  try {
    const token = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    return isAllowedAdminToken(token) ? token : null;
  } catch {
    return null;
  }
}

export async function hasVerifiedAdminSession(): Promise<boolean> {
  return Boolean(await getVerifiedAdminSession());
}
