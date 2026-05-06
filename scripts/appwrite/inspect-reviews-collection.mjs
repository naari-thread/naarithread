import "dotenv/config";

import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
const reviewsCollectionId = "reviews";

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const attributes = await databases.listAttributes(databaseId, reviewsCollectionId);

console.log("reviews attributes:");
for (const attribute of attributes.attributes) {
  console.log("-", {
    key: attribute.key,
    type: attribute.type,
    array: attribute.array,
    required: attribute.required,
    status: attribute.status,
  });
}

const indexList = await databases.listIndexes(databaseId, reviewsCollectionId);
console.log("\nreviews indexes:");
for (const index of indexList.indexes) {
  console.log("-", {
    key: index.key,
    type: index.type,
    attributes: index.attributes,
  });
}

const documents = await databases.listDocuments(databaseId, reviewsCollectionId, [
  Query.limit(10),
  Query.orderDesc("$createdAt"),
]);

console.log("\nlatest review docs:");
for (const doc of documents.documents) {
  console.log(doc.$id, {
    productId: doc.productId ?? null,
    userId: doc.userId ?? null,
    userName: doc.userName ?? null,
    rating: doc.rating ?? null,
    comment: doc.comment ?? null,
    isApproved: doc.isApproved ?? null,
    isVerifiedPurchase: doc.isVerifiedPurchase ?? null,
    permissions: doc.$permissions ?? null,
  });
}

const productIds = Array.from(
  new Set(
    documents.documents
      .map((doc) => String(doc.productId ?? "").trim())
      .filter(Boolean)
  )
);

if (productIds.length > 0) {
  const skuCollectionId = "sku";
  let skuMatches = { documents: [] };

  try {
    skuMatches = await databases.listDocuments(databaseId, skuCollectionId, [
      Query.equal("sku", productIds),
      Query.limit(20),
    ]);
  } catch (error) {
    console.log("\nsku query failed:", String(error?.message ?? error));
  }

  if (skuMatches.documents.length === 0) {
    try {
      skuMatches = await databases.listDocuments(databaseId, skuCollectionId, [
        Query.equal("$id", productIds),
        Query.limit(20),
      ]);
    } catch (error) {
      console.log("\n$id query failed:", String(error?.message ?? error));
    }
  }

  console.log("\nmatching sku docs:");
  for (const doc of skuMatches.documents) {
    console.log(doc.$id, {
      sku: doc.sku ?? null,
      slug: doc.slug ?? null,
      name: doc.name ?? null,
    });
  }
}
