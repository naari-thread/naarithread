"use client";

export type ProductReview = {
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

type CreateProductReviewInput = {
  jwt: string;
  productId: string;
  comment: string;
  rating: number;
  title?: string;
  imageUrls?: string[];
};

function toProductReview(value: unknown): ProductReview | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const productId = typeof record.productId === "string" ? record.productId.trim() : "";
  const userId = typeof record.userId === "string" ? record.userId.trim() : "";
  if (!id || !productId || !userId) {
    return null;
  }

  const ratingValue = typeof record.rating === "number" ? record.rating : Number(record.rating);
  const rating = Number.isFinite(ratingValue)
    ? Math.max(1, Math.min(5, Math.trunc(ratingValue)))
    : 5;

  return {
    id,
    productId,
    userId,
    userName: typeof record.userName === "string" ? record.userName.trim() || "Guest" : "Guest",
    userEmail: typeof record.userEmail === "string" ? record.userEmail.trim() : "",
    rating,
    title: typeof record.title === "string" ? record.title.trim() : "",
    comment: typeof record.comment === "string" ? record.comment.trim() : "",
    imageUrls: Array.isArray(record.imageUrls)
      ? record.imageUrls
          .filter((url): url is string => typeof url === "string")
          .map((url) => url.trim())
          .filter(Boolean)
      : [],
    isVerifiedPurchase: record.isVerifiedPurchase === true,
    isApproved: record.isApproved !== false,
    createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: unknown };
    return typeof payload.error === "string" && payload.error.trim()
      ? payload.error.trim()
      : fallback;
  } catch {
    return fallback;
  }
}

export async function listProductReviews(productId: string): Promise<ProductReview[]> {
  const normalizedProductId = productId.trim();
  if (!normalizedProductId) {
    return [];
  }

  const params = new URLSearchParams({ productId: normalizedProductId });
  const response = await fetch(`/api/catalog/reviews?${params.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Could not load reviews right now."));
  }

  const payload = (await response.json()) as { reviews?: unknown };
  if (!Array.isArray(payload.reviews)) {
    return [];
  }

  return payload.reviews.flatMap((review) => {
    const normalized = toProductReview(review);
    return normalized ? [normalized] : [];
  });
}

export async function createProductReview(input: CreateProductReviewInput): Promise<ProductReview> {
  const response = await fetch("/api/catalog/reviews", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${input.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: input.productId,
      rating: input.rating,
      comment: input.comment,
      title: input.title ?? "",
      imageUrls: input.imageUrls ?? [],
    }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, "Could not submit your review right now."));
  }

  const payload = (await response.json()) as { review?: unknown };
  const review = toProductReview(payload.review);
  if (!review) {
    throw new Error("The review was saved, but the response was invalid. Please refresh the page.");
  }

  return review;
}
