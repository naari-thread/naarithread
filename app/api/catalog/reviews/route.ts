import { NextResponse } from "next/server";
import { Query, type Models } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const REVIEWS_COLLECTION_CANDIDATES = ["reviews", "review"] as const;

type ReviewDocument = Models.Document & {
  productId?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  rating?: number;
  title?: string;
  comment?: string;
  imageUrls?: string[];
  isVerifiedPurchase?: boolean;
  isApproved?: boolean;
};

function toReviewRecord(document: ReviewDocument) {
  return {
    id: document.$id,
    productId: String(document.productId ?? "").trim(),
    userId: String(document.userId ?? "").trim(),
    userName: String(document.userName ?? "Guest").trim() || "Guest",
    userEmail: String(document.userEmail ?? "").trim(),
    rating: Math.max(1, Math.min(5, Math.trunc(Number(document.rating ?? 5) || 5))),
    title: String(document.title ?? "").trim(),
    comment: String(document.comment ?? "").trim(),
    imageUrls: Array.isArray(document.imageUrls)
      ? document.imageUrls.map((url) => String(url ?? "").trim()).filter(Boolean)
      : [],
    isVerifiedPurchase: Boolean(document.isVerifiedPurchase),
    isApproved: typeof document.isApproved === "boolean" ? document.isApproved : true,
    createdAt: String(document.$createdAt ?? ""),
  };
}

async function resolveReviewsCollectionId(databases: ReturnType<typeof createDatabasesWithApiKey>, databaseId: string) {
  for (const collectionId of REVIEWS_COLLECTION_CANDIDATES) {
    try {
      await databases.listDocuments(databaseId, collectionId, [Query.limit(1)]);
      return collectionId;
    } catch {
      // Try next fallback collection candidate.
    }
  }

  return null;
}

function matchesProductId(document: ReviewDocument, matchValues: string[]) {
  const candidate = [
    document.productId,
    (document as { productID?: string }).productID,
    (document as { sku?: string }).sku,
    (document as { productSku?: string }).productSku,
    (document as { product?: string }).product,
    (document as { slug?: string }).slug,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return candidate.some((value) => matchValues.includes(value));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId")?.trim() ?? "";
    const aliases = url.searchParams.get("aliases")?.split(",").map((value) => value.trim()) ?? [];
    const matchValues = Array.from(new Set([productId, ...aliases].filter(Boolean)));

    if (matchValues.length === 0) {
      return NextResponse.json({ reviews: [] });
    }

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const collectionId = await resolveReviewsCollectionId(databases, databaseId);

    if (!collectionId) {
      return NextResponse.json({ reviews: [] });
    }

    let response: Models.DocumentList<ReviewDocument>;
    try {
      response = await databases.listDocuments(databaseId, collectionId, [
        Query.equal("productId", matchValues),
        Query.equal("isApproved", true),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]);
    } catch {
      response = await databases.listDocuments(databaseId, collectionId, [
        Query.equal("productId", matchValues),
        Query.orderDesc("$createdAt"),
        Query.limit(50),
      ]);
    }

    let records = response.documents.filter((document) => document.isApproved !== false);
    if (records.length === 0) {
      const fallback = await databases.listDocuments<ReviewDocument>(databaseId, collectionId, [
        Query.orderDesc("$createdAt"),
        Query.limit(200),
      ]);
      records = fallback.documents.filter(
        (document) => document.isApproved !== false && matchesProductId(document, matchValues)
      );
    }

    return NextResponse.json({ reviews: records.map(toReviewRecord) });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load reviews.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
