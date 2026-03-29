import "dotenv/config";

import { Client, Databases, ID, Permission, Query, Role } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
const productsCollectionId = "sku";
const reviewsCollectionId = "reviews";

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const reviewTemplates = [
  { rating: 5, comment: "Amazing finish and stitching quality. The fabric falls beautifully and feels premium.", isVerifiedPurchase: true },
  { rating: 4, comment: "Very flattering look and color. Delivery was on time and the piece matched photos well.", isVerifiedPurchase: true },
  { rating: 5, comment: "Loved the overall craftsmanship. Comfortable for long events and very elegant in person.", isVerifiedPurchase: true },
  { rating: 4, comment: "Great design and fit. Minor alteration needed at waist, otherwise perfect purchase.", isVerifiedPurchase: true },
  { rating: 5, comment: "Beautiful drape and detailing. Got compliments all evening.", isVerifiedPurchase: true },
  { rating: 4, comment: "Good quality and neat finishing. Would buy again from this collection.", isVerifiedPurchase: true },
];

const seedUsers = [
  { userId: "seed-user-a", userName: "Aarohi", userEmail: "aarohi.seed@naarithread.local" },
  { userId: "seed-user-b", userName: "Meera", userEmail: "meera.seed@naarithread.local" },
  { userId: "seed-user-c", userName: "Ira", userEmail: "ira.seed@naarithread.local" },
  { userId: "seed-user-d", userName: "Kavya", userEmail: "kavya.seed@naarithread.local" },
  { userId: "seed-user-e", userName: "Saanvi", userEmail: "saanvi.seed@naarithread.local" },
  { userId: "seed-user-f", userName: "Riya", userEmail: "riya.seed@naarithread.local" },
];

async function listProducts(limit = 12) {
  const response = await databases.listDocuments(databaseId, productsCollectionId, [
    Query.limit(Math.max(limit * 2, 20)),
    Query.orderDesc("$createdAt"),
  ]);

  return response.documents
    .filter((document) => {
      if (typeof document.isActive === "boolean") {
        return document.isActive;
      }

      return true;
    })
    .slice(0, limit);
}

async function listExistingReviewsForProduct(productId) {
  const response = await databases.listDocuments(databaseId, reviewsCollectionId, [
    Query.equal("productId", productId),
    Query.limit(200),
  ]);

  return response.documents;
}

async function createReview({ productId, user, template }) {
  const payload = {
    productId,
    userId: user.userId,
    userName: user.userName,
    userEmail: user.userEmail,
    rating: template.rating,
    title: "",
    comment: template.comment,
    isVerifiedPurchase: template.isVerifiedPurchase,
    isApproved: true,
  };

  const permissions = [
    Permission.read(Role.any()),
    Permission.update(Role.label("admin")),
    Permission.delete(Role.label("admin")),
  ];

  const removableKeys = new Set(["rating", "title", "isVerifiedPurchase", "isApproved"]);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await databases.createDocument(databaseId, reviewsCollectionId, ID.unique(), payload, permissions);
    } catch (error) {
      const message = String(error?.message ?? "");
      const match = message.match(/Unknown attribute:\s*"([^"]+)"/i);
      const unknownKey = match?.[1];

      if (!unknownKey || !removableKeys.has(unknownKey)) {
        throw error;
      }

      delete payload[unknownKey];
    }
  }

  throw new Error("Could not create review after schema fallback attempts.");
}

async function run() {
  const products = await listProducts(10);
  if (products.length === 0) {
    console.log("No active products found. Seed skipped.");
    return;
  }

  let createdCount = 0;
  let skippedCount = 0;

  for (let productIndex = 0; productIndex < products.length; productIndex += 1) {
    const product = products[productIndex];
    const productId = String(product.$id ?? "").trim();
    if (!productId) {
      continue;
    }

    const existingReviews = await listExistingReviewsForProduct(productId);
    const existingKeys = new Set(
      existingReviews.map((doc) => `${String(doc.userId ?? "").trim()}::${String(doc.comment ?? "").trim().toLowerCase()}`)
    );

    const reviewTarget = 3;
    for (let offset = 0; offset < reviewTarget; offset += 1) {
      const user = seedUsers[(productIndex + offset) % seedUsers.length];
      const template = reviewTemplates[(productIndex * 2 + offset) % reviewTemplates.length];
      const dedupeKey = `${user.userId}::${template.comment.toLowerCase()}`;

      if (existingKeys.has(dedupeKey)) {
        skippedCount += 1;
        continue;
      }

      await createReview({ productId, user, template });
      existingKeys.add(dedupeKey);
      createdCount += 1;
    }
  }

  console.log(`Seed complete. Created ${createdCount} reviews, skipped ${skippedCount} existing duplicates.`);
}

run().catch((error) => {
  console.error("Failed to seed reviews:", error?.message ?? error);
  process.exit(1);
});
