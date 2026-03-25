import { NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return header.slice(7).trim();
}

export async function POST(request: Request) {
  const jwt = getBearerToken(request);
  if (!jwt) {
    console.warn("[auth-profile-api] missing bearer token");
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const user = await getUserFromJwt(jwt);
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const usersCollectionId = process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID ?? "users";
    const isAdmin = false;

    console.info("[auth-profile-api] sync start", {
      userId: user.$id,
      email: user.email,
      databaseId,
      usersCollectionId,
    });

    const [byUserId, byEmail] = await Promise.all([
      databases.listDocuments(databaseId, usersCollectionId, [Query.equal("userId", user.$id), Query.limit(1)]),
      databases.listDocuments(databaseId, usersCollectionId, [Query.equal("email", user.email), Query.limit(1)]),
    ]);

    const existing = byUserId.documents[0] ?? byEmail.documents[0] ?? null;

    if (existing) {
      console.info("[auth-profile-api] existing profile found, updating", {
        documentId: existing.$id,
        userId: user.$id,
      });
      const updated = await databases.updateDocument(databaseId, usersCollectionId, existing.$id, {
        userId: user.$id,
        fullName: user.name ?? "",
        email: user.email,
        isAdmin,
      });

      console.info("[auth-profile-api] update success", {
        profileId: updated.$id,
      });

      return NextResponse.json({ ok: true, profileId: updated.$id });
    }

    console.info("[auth-profile-api] no profile found, creating", {
      documentId: user.$id,
      userId: user.$id,
    });

    const created = await databases.createDocument(
      databaseId,
      usersCollectionId,
      user.$id || ID.unique(),
      {
        userId: user.$id,
        fullName: user.name ?? "",
        email: user.email,
        phone: "",
        address: "",
        isAdmin,
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ]
    );

    console.info("[auth-profile-api] create success", {
      profileId: created.$id,
    });

    return NextResponse.json({ ok: true, profileId: created.$id }, { status: 201 });
  } catch (error) {
    console.error("[auth-profile-api] sync failed", {
      error,
    });
    return NextResponse.json(
      {
        error: "Failed to sync user profile.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
