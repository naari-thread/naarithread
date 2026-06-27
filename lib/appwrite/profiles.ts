"use client";

import { type Models } from "appwrite";

export type UserProfileDocument = Models.Document & {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  isAdmin: boolean;
};

/**
 * Read the signed-in user's profile through the server route (Admin SDK).
 *
 * Direct client Firestore reads of the `users` collection are blocked by
 * security rules on production, so all profile access goes server-side.
 * Returns null on any failure so callers can fall back gracefully.
 */
export async function fetchUserProfileViaApi(jwt: string): Promise<UserProfileDocument | null> {
  try {
    const res = await fetch("/api/account/profile", {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { profile?: UserProfileDocument };
    return data.profile ?? null;
  } catch {
    return null;
  }
}

/**
 * Persist profile changes through the server route (Admin SDK). The server
 * resolves the target document, so no documentId is required from the client.
 */
export async function saveUserProfileViaApi(
  jwt: string,
  input: { fullName: string; phone: string; address: string }
): Promise<UserProfileDocument> {
  const res = await fetch("/api/account/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Failed to save profile.");
  }
  const data = (await res.json()) as { profile?: UserProfileDocument };
  if (!data.profile) {
    throw new Error("Failed to save profile.");
  }
  return data.profile;
}
