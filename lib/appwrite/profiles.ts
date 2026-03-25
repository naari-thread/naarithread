"use client";

import { Permission, Query, Role, type Models } from "appwrite";
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

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message ?? "").toLowerCase();
  }

  return String(error ?? "").toLowerCase();
}

function isPermissionError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("not authorized") ||
    message.includes("unauthorized") ||
    message.includes("permission") ||
    message.includes("missing scope")
  );
}

function isAlreadyExistsError(error: unknown) {
  const message = getErrorMessage(error);

  return (
    message.includes("already exists") ||
    message.includes("already exist") ||
    message.includes("document with the requested id") ||
    message.includes("already in use") ||
    message.includes("duplicate")
  );
}

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
  console.info("[auth-profile] start getOrCreateUserProfile", {
    userId: user.$id,
    email: user.email,
    isAdmin,
    databaseId: appwritePublicConfig.databaseId,
    usersCollectionId: appwritePublicConfig.usersCollectionId,
  });

  const updateProfileIdentityIfNeeded = async (existing: UserProfileDocument) => {
    const shouldSyncIdentity = existing.fullName !== user.name || existing.email !== user.email || existing.isAdmin !== isAdmin;

    if (!shouldSyncIdentity) {
      console.info("[auth-profile] existing profile found, no identity sync needed", {
        documentId: existing.$id,
        userId: user.$id,
      });
      return existing;
    }

    console.info("[auth-profile] updating existing profile identity", {
      documentId: existing.$id,
      userId: user.$id,
      email: user.email,
    });

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
  };

  const createProfile = async () => {
    console.info("[auth-profile] creating new profile row", {
      documentId: user.$id,
      userId: user.$id,
      email: user.email,
    });

    try {
      return await databases.createDocument<UserProfileDocument>(
        appwritePublicConfig.databaseId,
        appwritePublicConfig.usersCollectionId,
        user.$id,
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
        ]
      );
    } catch (error) {
      console.error("[auth-profile] create profile failed", {
        userId: user.$id,
        email: user.email,
        error,
      });
      throw normalizeProfileError(error);
    }
  };

  // Try list lookups first to avoid noisy get-by-id 404 calls on first login.
  for (const query of [[Query.equal("userId", user.$id), Query.limit(1)], [Query.equal("email", user.email), Query.limit(1)]]) {
    try {
      const list = await databases.listDocuments<UserProfileDocument>(
        appwritePublicConfig.databaseId,
        appwritePublicConfig.usersCollectionId,
        query
      );

      const existing = list.documents[0] ?? null;
      if (existing) {
        console.info("[auth-profile] found profile via list query fallback", {
          query: query[0],
          documentId: existing.$id,
          userId: user.$id,
        });
        return await updateProfileIdentityIfNeeded(existing);
      }

      console.info("[auth-profile] list query returned no profile", {
        query: query[0],
        userId: user.$id,
      });
    } catch (error) {
      const normalized = normalizeProfileError(error);
      console.warn("[auth-profile] list query fallback failed", {
        query: query[0],
        userId: user.$id,
        email: user.email,
        error: normalized,
      });
      if (!isPermissionError(normalized)) {
        throw normalized;
      }
    }
  }

  try {
    const created = await createProfile();
    console.info("[auth-profile] created profile successfully", {
      documentId: created.$id,
      userId: user.$id,
    });
    return created;
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      console.error("[auth-profile] create profile failed with non-duplicate error", {
        userId: user.$id,
        email: user.email,
        error,
      });
      throw error;
    }

    // Duplicate usually means profile exists but may not be readable from client. Do not fail auth flow.
    console.warn("[auth-profile] duplicate on create; profile likely already exists but is not client-readable", {
      userId: user.$id,
      email: user.email,
    });
    return null;
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
