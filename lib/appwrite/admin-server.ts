import { Databases } from "node-appwrite";

import { getServerAdminEmails, verifyFirebaseIdToken } from "@/lib/firebase/admin";

export function getAdminEmails(): string[] {
  return getServerAdminEmails();
}

export function isAllowedAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function createApiKeyClient(): null {
  return null;
}

export function createDatabasesWithApiKey(): Databases {
  return new Databases();
}

export async function getUserFromJwt(jwt: string): Promise<{
  $id: string;
  email: string;
  name: string;
}> {
  const decoded = await verifyFirebaseIdToken(jwt);
  return {
    $id: decoded.uid,
    email: decoded.email ?? "",
    name: decoded.name ?? decoded.email ?? "",
  };
}

export function getDatabaseId(): string {
  return process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread";
}
