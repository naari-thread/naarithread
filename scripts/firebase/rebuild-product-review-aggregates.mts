import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  initializeFirestore,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";

type PendingWrite = {
  ref: DocumentReference;
  data: Record<string, unknown>;
};

type Aggregate = {
  count: number;
  total: number;
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function createCredential(): ReturnType<typeof cert> | ReturnType<typeof applicationDefault> {
  const serviceAccountJson = env("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (serviceAccountJson) {
    const parsed = JSON.parse(serviceAccountJson) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      });
    }
  }

  const projectId = env("FIREBASE_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (env("GOOGLE_APPLICATION_CREDENTIALS")) {
    return applicationDefault();
  }

  throw new Error("Firebase Admin credentials are not configured.");
}

function normalizeReference(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isDifferentNumber(current: unknown, next: number): boolean {
  return Math.abs(toNumber(current) - next) > 0.000_001;
}

async function commitWrites(
  db: ReturnType<typeof initializeFirestore>,
  writes: PendingWrite[]
): Promise<void> {
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = db.batch();
    for (const write of writes.slice(offset, offset + 450)) {
      batch.set(write.ref, write.data, { merge: true });
    }
    await batch.commit();
  }
}

async function main(): Promise<void> {
  const applyChanges = process.argv.includes("--apply");
  const projectId = env("FIREBASE_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || "naarithread";
  const app = initializeApp({ credential: createCredential(), projectId });
  const db = initializeFirestore(app, { preferRest: true });

  const [productsSnapshot, reviewsSnapshot] = await Promise.all([
    db.collection("products").get(),
    db.collection("reviews").get(),
  ]);

  const referenceToProductId = new Map<string, string | null>();
  const productDataById = new Map<string, DocumentData>();
  const aggregatesByProductId = new Map<string, Aggregate>();

  for (const productDocument of productsSnapshot.docs) {
    const data = productDocument.data();
    productDataById.set(productDocument.id, data);
    aggregatesByProductId.set(productDocument.id, { count: 0, total: 0 });

    for (const value of [productDocument.id, data.sku, data.slug]) {
      const reference = normalizeReference(value);
      if (!reference) {
        continue;
      }

      const existing = referenceToProductId.get(reference);
      referenceToProductId.set(
        reference,
        existing && existing !== productDocument.id ? null : productDocument.id
      );
    }
  }

  const reviewWrites: PendingWrite[] = [];
  let approvedReviewCount = 0;
  let unmatchedReviewCount = 0;

  for (const reviewDocument of reviewsSnapshot.docs) {
    const data = reviewDocument.data();
    const references = [
      data.productId,
      data.productID,
      data.sku,
      data.productSku,
      data.product,
      data.slug,
    ];
    const productId = references
      .map(normalizeReference)
      .filter(Boolean)
      .map((reference) => referenceToProductId.get(reference))
      .find((value): value is string => typeof value === "string");

    if (!productId) {
      unmatchedReviewCount += 1;
      continue;
    }

    const isApproved = data.isApproved !== false;
    if (isApproved) {
      const rating = Math.max(1, Math.min(5, toNumber(data.rating, 5)));
      const aggregate = aggregatesByProductId.get(productId) ?? { count: 0, total: 0 };
      aggregate.count += 1;
      aggregate.total += rating;
      aggregatesByProductId.set(productId, aggregate);
      approvedReviewCount += 1;
    }

    if (data.productId !== productId || typeof data.isApproved !== "boolean") {
      reviewWrites.push({
        ref: reviewDocument.ref,
        data: {
          productId,
          isApproved,
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
    }
  }

  const productWrites: PendingWrite[] = [];
  for (const productDocument of productsSnapshot.docs) {
    const current = productDataById.get(productDocument.id) ?? {};
    const aggregate = aggregatesByProductId.get(productDocument.id) ?? { count: 0, total: 0 };
    const rating = aggregate.count > 0 ? aggregate.total / aggregate.count : 0;

    if (
      Math.trunc(toNumber(current.ratingCount)) !== aggregate.count ||
      isDifferentNumber(current.ratingTotal, aggregate.total) ||
      isDifferentNumber(current.rating, rating)
    ) {
      productWrites.push({
        ref: productDocument.ref,
        data: {
          rating,
          ratingCount: aggregate.count,
          ratingTotal: aggregate.total,
          updatedAt: FieldValue.serverTimestamp(),
        },
      });
    }
  }

  const summary = {
    mode: applyChanges ? "apply" : "dry-run",
    projectId,
    productsScanned: productsSnapshot.size,
    reviewsScanned: reviewsSnapshot.size,
    approvedReviewsMatched: approvedReviewCount,
    unmatchedReviews: unmatchedReviewCount,
    productAggregatesToUpdate: productWrites.length,
    reviewsToNormalize: reviewWrites.length,
  };

  if (applyChanges) {
    await commitWrites(db, [...reviewWrites, ...productWrites]);
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Review aggregate rebuild failed.");
  process.exitCode = 1;
});
