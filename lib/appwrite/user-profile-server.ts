import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, isAllowedAdminEmail } from "@/lib/appwrite/admin-server";

/**
 * Server-side canonical user-profile resolution.
 *
 * The canonical profile document is ALWAYS `users/{firebaseUid}`. Legacy rows
 * (random doc ids created by older flows, or duplicates) are merged into the
 * canonical doc and then deleted, so a given user/email maps to exactly one row.
 *
 * Runs with the Admin SDK (bypasses Firestore security rules), because direct
 * client Firestore access to the users collection is blocked on production.
 */

const USERS_COL = "users";

type Databases = ReturnType<typeof createDatabasesWithApiKey>;

export type AuthedUser = { $id: string; email: string; name: string };

export type ServerProfile = {
  $id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  isAdmin: boolean;
};

export type ProfileOverrides = Partial<{ fullName: string; phone: string; address: string }>;

function str(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

/** Collect the canonical doc plus any legacy docs matching userId or email. */
async function collectCandidates(
  user: AuthedUser,
  databases: Databases,
  databaseId: string
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  const canonical = await databases.getDocument(databaseId, USERS_COL, user.$id).catch(() => null);
  if (canonical) {
    out.push(canonical as Record<string, unknown>);
    seen.add(user.$id);
  }

  const queries: unknown[][] = [[Query.equal("userId", user.$id), Query.limit(25)]];
  if (user.email) {
    queries.push([Query.equal("email", user.email), Query.limit(25)]);
  }

  for (const q of queries) {
    const list = await databases
      .listDocuments(databaseId, USERS_COL, q)
      .catch(() => ({ documents: [] as Record<string, unknown>[] }));
    for (const doc of list.documents) {
      const id = str(doc.$id);
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(doc as Record<string, unknown>);
      }
    }
  }

  return out;
}

/** First non-empty value of `field` across candidates (canonical preferred — it's first). */
function firstNonEmpty(candidates: Record<string, unknown>[], field: string): string {
  for (const candidate of candidates) {
    const value = str(candidate[field]).trim();
    if (value) return value;
  }
  return "";
}

/**
 * Resolve (and self-heal) the canonical profile. Always writes `users/{uid}`,
 * merges any data found on legacy duplicates, and deletes those duplicates.
 * Pass `overrides` to apply user-supplied edits in the same write.
 */
export async function resolveUserProfile(user: AuthedUser, overrides?: ProfileOverrides): Promise<ServerProfile> {
  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();
  const uid = user.$id;

  const candidates = await collectCandidates(user, databases, databaseId);

  // Build the merged record. Explicit overrides win; otherwise keep the newest
  // non-empty value so a saved address on a legacy doc is never lost. fullName
  // never collapses to empty.
  const merged = {
    userId: uid,
    email: user.email,
    isAdmin: isAllowedAdminEmail(user.email),
    fullName: overrides?.fullName?.trim() || firstNonEmpty(candidates, "fullName") || user.name || "",
    phone: overrides?.phone ?? firstNonEmpty(candidates, "phone"),
    address: overrides?.address ?? firstNonEmpty(candidates, "address"),
  };

  const canonicalExists = candidates.some((candidate) => str(candidate.$id) === uid);
  const saved = canonicalExists
    ? await databases.updateDocument(databaseId, USERS_COL, uid, merged)
    : await databases.createDocument(databaseId, USERS_COL, uid, merged);

  // Remove legacy duplicates so email/userId map to exactly one row.
  await Promise.all(
    candidates
      .filter((candidate) => str(candidate.$id) !== uid)
      .map((candidate) =>
        databases.deleteDocument(databaseId, USERS_COL, str(candidate.$id)).catch(() => undefined)
      )
  );

  const savedDoc = saved as Record<string, unknown>;
  return {
    $id: uid,
    userId: uid,
    fullName: str(savedDoc.fullName) || merged.fullName,
    email: merged.email,
    phone: str(savedDoc.phone),
    address: str(savedDoc.address),
    isAdmin: merged.isAdmin,
  };
}
