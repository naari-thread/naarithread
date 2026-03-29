import "dotenv/config";

import { Client, Databases, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
const collectionId = "sku";

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const BASE_SIZE_SCALE = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const DEFAULT_SIZES = ["S", "M", "L", "XL"];

function uniqueNormalized(values) {
  const seen = new Set();
  const output = [];

  for (const rawValue of values) {
    if (typeof rawValue !== "string") {
      continue;
    }

    for (const token of rawValue.split(/[\n,|/]+/)) {
      const trimmed = token.trim();
      if (!trimmed) {
        continue;
      }

      const upper = trimmed.toUpperCase();
      const normalized = upper === "FREESIZE" ? "FREE SIZE" : upper;
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      output.push(normalized);
    }
  }

  return output;
}

function ensureMultipleSizes(existingSizeOptions, legacySize) {
  const fromExisting = Array.isArray(existingSizeOptions) ? existingSizeOptions : [];
  const normalized = uniqueNormalized([...fromExisting, legacySize]);

  if (normalized.length >= 2) {
    return normalized;
  }

  if (normalized.length === 1) {
    const [single] = normalized;

    if (single === "FREE SIZE") {
      return ["FREE SIZE", "STANDARD"];
    }

    const scaleIndex = BASE_SIZE_SCALE.indexOf(single);
    if (scaleIndex >= 0) {
      const start = Math.max(0, scaleIndex - 1);
      const end = Math.min(BASE_SIZE_SCALE.length, scaleIndex + 3);
      const segment = BASE_SIZE_SCALE.slice(start, end);
      if (segment.length >= 2) {
        return segment;
      }
    }

    const fallback = uniqueNormalized([single, ...DEFAULT_SIZES]);
    return fallback.slice(0, 4);
  }

  return [...DEFAULT_SIZES];
}

async function listAllProducts() {
  let offset = 0;
  let total = 0;
  const documents = [];

  do {
    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(100),
      Query.offset(offset),
    ]);

    total = response.total;
    documents.push(...response.documents);
    offset += response.documents.length;

    if (response.documents.length === 0) {
      break;
    }
  } while (offset < total);

  return documents;
}

async function ensureSizeOptionsAttribute() {
  const attributes = await databases.listAttributes(databaseId, collectionId);
  const existing = attributes.attributes.find((attribute) => attribute.key === "sizeOptions");

  if (existing) {
    return;
  }

  console.log("Creating sku.sizeOptions attribute as string[]...");
  await databases.createStringAttribute({
    databaseId,
    collectionId,
    key: "sizeOptions",
    size: 40,
    required: false,
    array: true,
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const refreshed = await databases.listAttributes(databaseId, collectionId);
    const created = refreshed.attributes.find((attribute) => attribute.key === "sizeOptions");
    if (created && created.status === "available") {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }

  throw new Error("Timed out while waiting for sku.sizeOptions attribute to become available.");
}

async function run() {
  await ensureSizeOptionsAttribute();
  const products = await listAllProducts();

  let updatedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    const current = Array.isArray(product.sizeOptions) ? uniqueNormalized(product.sizeOptions) : [];
    const next = ensureMultipleSizes(product.sizeOptions, typeof product.size === "string" ? product.size : "");

    const isSame = current.length === next.length && current.every((value, index) => value === next[index]);
    if (isSame) {
      skippedCount += 1;
      continue;
    }

    await databases.updateDocument(databaseId, collectionId, product.$id, {
      sizeOptions: next,
    });
    updatedCount += 1;
  }

  console.log(`Processed products: ${products.length}`);
  console.log(`Updated products: ${updatedCount}`);
  console.log(`Already aligned: ${skippedCount}`);
}

run().catch((error) => {
  console.error("Failed to backfill size options:", error);
  process.exit(1);
});
