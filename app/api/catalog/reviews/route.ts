import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { NextResponse } from "next/server";

import { toProductRecord, type ProductRecord } from "@/lib/appwrite/products";
import { PRODUCT_CATALOG_CACHE_TAG, PRODUCT_REVIEWS_CACHE_TAG } from "@/lib/cache-tags";
import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { getAdminDb, getBearerToken } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import { timestampToIso } from "@/lib/firebase/document";
import { readProductSearchIndex } from "@/lib/firebase/product-search-index";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REVIEW_CACHE_SECONDS = 900;
const MAX_COMMENT_LENGTH = 2_000;
const MAX_TITLE_LENGTH = 120;
const MAX_IMAGE_URL_LENGTH = 2_048;

type ReviewRecord = {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userEmail: string;
  rating: number;
  title: string;
  comment: string;
  imageUrls: string[];
  isVerifiedPurchase: boolean;
  isApproved: boolean;
  createdAt: string;
};

type CreateReviewInput = {
  productId: string;
  rating: number;
  title: string;
  comment: string;
  imageUrls: string[];
};

class ReviewRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ReviewRequestError";
    this.status = status;
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toReviewRecord(id: string, document: DocumentData): ReviewRecord {
  return {
    id,
    productId: String(document.productId ?? "").trim(),
    userId: String(document.userId ?? "").trim(),
    userName: String(document.userName ?? "Guest").trim() || "Guest",
    userEmail: String(document.userEmail ?? "").trim(),
    rating: Math.max(1, Math.min(5, Math.trunc(toNumber(document.rating, 5)))),
    title: String(document.title ?? "").trim(),
    comment: String(document.comment ?? "").trim(),
    imageUrls: Array.isArray(document.imageUrls)
      ? document.imageUrls
          .filter((url: unknown): url is string => typeof url === "string")
          .map((url: string) => url.trim())
          .filter(Boolean)
      : [],
    isVerifiedPurchase: document.isVerifiedPurchase === true,
    isApproved: document.isApproved !== false,
    createdAt: timestampToIso(document.createdAt),
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function parseCreateReviewInput(value: unknown): CreateReviewInput {
  if (!value || typeof value !== "object") {
    throw new ReviewRequestError("Invalid review payload.", 400);
  }

  const input = value as Record<string, unknown>;
  const productId = typeof input.productId === "string" ? input.productId.trim() : "";
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const rating = toNumber(input.rating, 0);
  const imageUrls = Array.isArray(input.imageUrls)
    ? Array.from(
        new Set(
          input.imageUrls
            .filter((url): url is string => typeof url === "string")
            .map((url) => url.trim())
            .filter(Boolean)
        )
      )
    : [];

  if (!productId || productId.length > 256) {
    throw new ReviewRequestError("A valid product reference is required.", 400);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ReviewRequestError("Select a rating from 1 to 5.", 400);
  }
  if (!comment || comment.length > MAX_COMMENT_LENGTH) {
    throw new ReviewRequestError(`Review text must be between 1 and ${MAX_COMMENT_LENGTH} characters.`, 400);
  }
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ReviewRequestError(`Review title must be ${MAX_TITLE_LENGTH} characters or fewer.`, 400);
  }
  if (
    imageUrls.length > 3 ||
    imageUrls.some((url) => url.length > MAX_IMAGE_URL_LENGTH || !isHttpUrl(url))
  ) {
    throw new ReviewRequestError("Provide up to three valid review image URLs.", 400);
  }

  return { productId, rating, title, comment, imageUrls };
}

async function listApprovedProductReviewsUncached(productId: string): Promise<ReviewRecord[]> {
  const snapshot = await getAdminDb()
    .collection(FIRESTORE_COLLECTIONS.reviews)
    .where("productId", "==", productId)
    .where("isApproved", "==", true)
    .orderBy("createdAt", "desc")
    .limit(50)
    .get();

  return snapshot.docs.map((document) => toReviewRecord(document.id, document.data()));
}

const listApprovedProductReviewsCached = unstable_cache(
  listApprovedProductReviewsUncached,
  ["approved-product-reviews-v1"],
  {
    revalidate: REVIEW_CACHE_SECONDS,
    tags: [PRODUCT_REVIEWS_CACHE_TAG],
  }
);

async function createApprovedProductReview(
  input: CreateReviewInput,
  user: { $id: string; email: string; name: string }
): Promise<{ product: ProductRecord; review: ReviewRecord }> {
  const db = getAdminDb();
  const productRef = db.collection(FIRESTORE_COLLECTIONS.products).doc(input.productId);
  const reviewRef = db.collection(FIRESTORE_COLLECTIONS.reviews).doc();

  const product = await db.runTransaction(async (transaction): Promise<ProductRecord> => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) {
      throw new ReviewRequestError("This product is no longer available.", 404);
    }

    const productData = productSnapshot.data() ?? {};
    const normalizedProduct = toProductRecord({
      ...productData,
      $id: productSnapshot.id,
      $createdAt: productData.createdAt,
    });
    if (!normalizedProduct.isActive) {
      throw new ReviewRequestError("This product is no longer available.", 404);
    }

    const currentCount = Math.max(0, Math.trunc(toNumber(productData.ratingCount)));
    const currentAverage = Math.max(0, Math.min(5, toNumber(productData.rating)));
    const currentTotal = Math.max(0, toNumber(productData.ratingTotal, currentAverage * currentCount));
    const nextCount = currentCount + 1;
    const nextTotal = currentTotal + input.rating;
    const nextAverage = nextTotal / nextCount;
    const timestamp = FieldValue.serverTimestamp();

    transaction.create(reviewRef, {
      productId: productSnapshot.id,
      userId: user.$id,
      userName: user.name.trim() || user.email.split("@")[0] || "Customer",
      userEmail: user.email.trim().toLowerCase(),
      rating: input.rating,
      title: input.title,
      comment: input.comment,
      imageUrls: input.imageUrls,
      isVerifiedPurchase: false,
      isApproved: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    transaction.set(
      productRef,
      {
        rating: nextAverage,
        ratingCount: nextCount,
        ratingTotal: nextTotal,
        updatedAt: timestamp,
      },
      { merge: true }
    );

    return { ...normalizedProduct, rating: nextAverage, ratingCount: nextCount };
  });

  const reviewSnapshot = await reviewRef.get();
  return {
    product,
    review: toReviewRecord(reviewSnapshot.id, reviewSnapshot.data() ?? {}),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const productId = new URL(request.url).searchParams.get("productId")?.trim() ?? "";
    if (!productId || productId.length > 256) {
      return NextResponse.json({ reviews: [] });
    }

    // Validate against the lightweight cached active-product index. This avoids
    // rereading the full product document that the detail page already loaded.
    const productExists = (await readProductSearchIndex()).some(
      (product) => product.id === productId
    );
    if (!productExists) {
      return NextResponse.json({ reviews: [] });
    }

    const reviews = await listApprovedProductReviewsCached(productId);
    return NextResponse.json(
      { reviews },
      { headers: { "Cache-Control": "public, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    console.error("[catalog-reviews-api] Failed to load reviews:", error);
    return NextResponse.json({ error: "Failed to load reviews." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Sign in to submit a review." }, { status: 401 });
  }

  try {
    const [user, body] = await Promise.all([
      getUserFromJwt(token),
      request.json() as Promise<unknown>,
    ]);
    const input = parseCreateReviewInput(body);
    const { product, review } = await createApprovedProductReview(input, user);

    revalidateTag(PRODUCT_CATALOG_CACHE_TAG, { expire: 0 });
    revalidateTag(PRODUCT_REVIEWS_CACHE_TAG, { expire: 0 });
    revalidatePath("/products");
    revalidatePath(`/products/${product.category}/${product.subCategory}/${product.slug}`);
    revalidatePath("/api/catalog/products");
    revalidatePath("/api/catalog/reviews");

    return NextResponse.json(
      { review },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    if (error instanceof ReviewRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[catalog-reviews-api] Failed to create review:", message);
    return NextResponse.json({ error: "Could not submit your review right now." }, { status: 500 });
  }
}
