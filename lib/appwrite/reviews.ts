"use client";

import { ID, Permission, Query, Role, type Models } from "appwrite";

import { appwritePublicConfig } from "@/lib/appwrite/constants";
import { getBrowserDatabases } from "@/lib/appwrite/client";

const REVIEWS_COLLECTION_CANDIDATES = ["reviews", "review"] as const;

export type ProductReview = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number;
  title: string;
  comment: string;
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
};

type ReviewDocument = Models.Document & {
  productId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  rating?: number;
  title?: string;
  comment?: string;
  isVerifiedPurchase?: boolean;
  isApproved?: boolean;
};

function toReviewRecord(document: ReviewDocument): ProductReview {
  return {
    id: document.$id,
    productId: String(document.productId ?? "").trim(),
    userId: String(document.userId ?? "").trim(),
    userName: String(document.userName ?? "Guest").trim() || "Guest",
    userEmail: String(document.userEmail ?? "").trim(),
    rating: Math.max(1, Math.min(5, Math.trunc(Number(document.rating ?? 5) || 5))),
    title: String(document.title ?? "").trim(),
    comment: String(document.comment ?? "").trim(),
    isVerifiedPurchase: Boolean(document.isVerifiedPurchase),
    isApproved: typeof document.isApproved === "boolean" ? document.isApproved : true,
    createdAt: String(document.$createdAt ?? ""),
  };
}

async function resolveReviewsCollectionId(jwt?: string) {
  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return null;
  }

  for (const collectionId of REVIEWS_COLLECTION_CANDIDATES) {
    try {
      await databases.listDocuments(appwritePublicConfig.databaseId, collectionId, [Query.limit(1)]);
      return collectionId;
    } catch {
      // Try next fallback collection candidate.
    }
  }

  return null;
}

export async function listProductReviews(productId: string, jwt?: string, aliases: string[] = []) {
  const matchValues = Array.from(new Set([productId, ...aliases].map((value) => value.trim()).filter(Boolean)));
  if (matchValues.length === 0) {
    return [] as ProductReview[];
  }

  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return [] as ProductReview[];
  }

  const collectionId = await resolveReviewsCollectionId(jwt);
  if (!collectionId) {
    return [] as ProductReview[];
  }

  let response;
  try {
    response = await databases.listDocuments<ReviewDocument>(
      appwritePublicConfig.databaseId,
      collectionId,
      [
        Query.equal("productId", matchValues),
        Query.equal("isApproved", true),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]
    );
  } catch {
    response = await databases.listDocuments<ReviewDocument>(
      appwritePublicConfig.databaseId,
      collectionId,
      [Query.equal("productId", matchValues), Query.orderDesc("$createdAt"), Query.limit(50)]
    );
  }

  return response.documents.map(toReviewRecord);
}

export async function createProductReview(input: {
  jwt: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail: string;
  comment: string;
  rating?: number;
  title?: string;
}) {
  const databases = getBrowserDatabases(input.jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    throw new Error("Appwrite database is not configured.");
  }

  const collectionId = await resolveReviewsCollectionId(input.jwt);
  if (!collectionId) {
    throw new Error("Reviews collection is not available.");
  }

  const safeComment = input.comment.trim();
  if (!safeComment) {
    throw new Error("Review message is required.");
  }

  const safeUserId = input.userId.trim();
  const safeProductId = input.productId.trim();

  if (!safeUserId || !safeProductId) {
    throw new Error("Missing user or product reference.");
  }

  const safeRating = Math.max(1, Math.min(5, Math.trunc(input.rating ?? 5)));
  const safeTitle = input.title?.trim() ?? "";

  const payload: Record<string, unknown> = {
    productId: safeProductId,
    userId: safeUserId,
    userName: input.userName.trim() || "Customer",
    userEmail: input.userEmail.trim().toLowerCase(),
    rating: safeRating,
    title: safeTitle,
    comment: safeComment,
    isVerifiedPurchase: true,
    isApproved: true,
  };

  const removableKeys = new Set(["rating", "title", "isVerifiedPurchase", "isApproved"]);
  let document: ReviewDocument | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      document = await databases.createDocument<ReviewDocument>(
        appwritePublicConfig.databaseId,
        collectionId,
        ID.unique(),
        payload,
        [
          Permission.read(Role.any()),
          Permission.update(Role.user(safeUserId)),
          Permission.delete(Role.user(safeUserId)),
        ]
      );
      break;
    } catch (error) {
      const message = typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "";
      const match = message.match(/Unknown attribute:\s*"([^"]+)"/i);
      const unknownKey = match?.[1];

      if (!unknownKey || !removableKeys.has(unknownKey)) {
        throw error;
      }

      delete payload[unknownKey];
    }
  }

  if (!document) {
    throw new Error("Could not create review for this schema.");
  }

  return toReviewRecord(document);
}
