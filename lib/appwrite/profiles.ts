"use client";

import { ID, Permission, Query, Role, type Models } from "appwrite";
import { appwritePublicConfig, hasUsersCollectionConfig } from "@/lib/appwrite/constants";
import { getBrowserDatabases } from "@/lib/appwrite/client";

export type UserProfileDocument = Models.Document & {
  userId: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  isAdmin: boolean;
};

function normalizeProfileError(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message ?? "");
    if (message.includes("Database with the requested ID")) {
      return new Error(
        "Invalid NEXT_PUBLIC_APPWRITE_DATABASE_ID. Use your Appwrite database ID (not database name), then restart dev server."
      );
    }
  }

  return error;
}

export async function getOrCreateUserProfile(args: {
  user: Models.User<Models.Preferences>;
  isAdmin: boolean;
}) {
  if (!hasUsersCollectionConfig()) {
    return null;
  }

  const databases = getBrowserDatabases();
  if (!databases) {
    return null;
  }

  const { user, isAdmin } = args;
  let list: Models.DocumentList<UserProfileDocument>;
  try {
    list = await databases.listDocuments<UserProfileDocument>(
      appwritePublicConfig.databaseId,
      appwritePublicConfig.usersCollectionId,
      [Query.equal("userId", user.$id), Query.limit(1)]
    );
  } catch (error) {
    throw normalizeProfileError(error);
  }

  const existing = list.documents[0];

  if (existing) {
    const shouldSyncIdentity = existing.fullName !== user.name || existing.email !== user.email || existing.isAdmin !== isAdmin;
    if (!shouldSyncIdentity) {
      return existing;
    }

    try {
      return await databases.updateDocument<UserProfileDocument>(
        appwritePublicConfig.databaseId,
        appwritePublicConfig.usersCollectionId,
        existing.$id,
        {
          fullName: user.name,
          email: user.email,
          isAdmin,
        }
      );
    } catch (error) {
      throw normalizeProfileError(error);
    }
  }

  try {
    return await databases.createDocument<UserProfileDocument>(
      appwritePublicConfig.databaseId,
      appwritePublicConfig.usersCollectionId,
      ID.unique(),
      {
        userId: user.$id,
        fullName: user.name,
        email: user.email,
        phone: "",
        address: "",
        isAdmin,
      },
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
        Permission.read(Role.label("admin")),
        Permission.update(Role.label("admin")),
        Permission.delete(Role.label("admin")),
      ]
    );
  } catch (error) {
    throw normalizeProfileError(error);
  }
}

export async function updateUserProfile(args: {
  documentId: string;
  fullName: string;
  phone: string;
  address: string;
}) {
  const databases = getBrowserDatabases();

  if (!databases || !hasUsersCollectionConfig()) {
    throw new Error("Users collection is not configured.");
  }

  return databases.updateDocument<UserProfileDocument>(
    appwritePublicConfig.databaseId,
    appwritePublicConfig.usersCollectionId,
    args.documentId,
    {
      fullName: args.fullName,
      phone: args.phone,
      address: args.address,
    }
  ).catch((error) => {
    throw normalizeProfileError(error);
  });
}
