import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt, isAllowedAdminEmail } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const USERS_COL = "users";

type ProfileResponse = {
  $id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  isAdmin: boolean;
};

type AuthedUser = { $id: string; email: string; name: string };
type Databases = ReturnType<typeof createDatabasesWithApiKey>;

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

function toProfile(doc: Record<string, unknown>, user: AuthedUser): ProfileResponse {
  return {
    $id: String(doc.$id ?? user.$id),
    userId: String(doc.userId ?? user.$id),
    fullName: String(doc.fullName ?? user.name ?? ""),
    email: String(doc.email ?? user.email ?? ""),
    phone: String(doc.phone ?? ""),
    address: String(doc.address ?? ""),
    isAdmin: Boolean(doc.isAdmin),
  };
}

/**
 * Resolve the user's profile via the Admin SDK (bypasses Firestore rules, which
 * block direct client reads on production). Creates the row on first access so
 * the account screen and cart prefill always have something to show.
 */
async function readOrCreateProfile(user: AuthedUser, databases: Databases, databaseId: string): Promise<ProfileResponse> {
  const byUserId = await databases.listDocuments(databaseId, USERS_COL, [Query.equal("userId", user.$id), Query.limit(1)]);
  let doc: Record<string, unknown> | null = byUserId.documents[0] ?? null;

  if (!doc && user.email) {
    const byEmail = await databases.listDocuments(databaseId, USERS_COL, [Query.equal("email", user.email), Query.limit(1)]);
    doc = byEmail.documents[0] ?? null;
  }

  if (!doc) {
    doc = await databases.getDocument(databaseId, USERS_COL, user.$id).catch(() => null);
  }

  if (!doc) {
    const created = await databases.createDocument(databaseId, USERS_COL, user.$id, {
      userId: user.$id,
      fullName: user.name ?? "",
      email: user.email,
      phone: "",
      address: "",
      isAdmin: isAllowedAdminEmail(user.email),
    });
    return toProfile(created as Record<string, unknown>, user);
  }

  return toProfile(doc as Record<string, unknown>, user);
}

export async function GET(request: Request): Promise<NextResponse> {
  const jwt = getBearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const databases = createDatabasesWithApiKey();
    const profile = await readOrCreateProfile(user, databases, getDatabaseId());
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("[account-profile] read failed", error);
    return NextResponse.json({ error: "Unable to load profile." }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  const jwt = getBearerToken(request);
  if (!jwt) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const body = (await request.json()) as { fullName?: unknown; phone?: unknown; address?: unknown };

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const existing = await readOrCreateProfile(user, databases, databaseId);

    const updated = await databases.updateDocument(databaseId, USERS_COL, existing.$id, {
      fullName: typeof body.fullName === "string" ? body.fullName : existing.fullName,
      phone: typeof body.phone === "string" ? body.phone : existing.phone,
      address: typeof body.address === "string" ? body.address : existing.address,
    });

    return NextResponse.json({ profile: toProfile(updated as Record<string, unknown>, user) });
  } catch (error) {
    console.error("[account-profile] update failed", error);
    return NextResponse.json({ error: "Unable to save profile." }, { status: 500 });
  }
}
