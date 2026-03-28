import "dotenv/config";

import { Client, Databases, Query } from "node-appwrite";

function toSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function resolveCollectionId() {
  const candidate = "sku";

  try {
    await databases.getCollection(databaseId, candidate);
    return candidate;
  } catch {
    throw new Error("Could not find sku collection.");
  }
}

async function run() {
  const collectionId = await resolveCollectionId();
  const list = await databases.listDocuments(databaseId, collectionId, [Query.limit(500)]);

  const slugUsage = new Map();
  let updated = 0;

  for (const doc of list.documents) {
    const base = toSlug(doc.slug || doc.name || doc.sku || doc.$id) || "product";
    let finalSlug = base;
    let iteration = 2;

    while (slugUsage.has(finalSlug)) {
      finalSlug = `${base}-${iteration}`;
      iteration += 1;
    }

    slugUsage.set(finalSlug, true);

    if (doc.slug === finalSlug) {
      continue;
    }

    await databases.updateDocument(databaseId, collectionId, doc.$id, { slug: finalSlug });
    updated += 1;
    console.log(`Updated ${doc.$id} -> ${finalSlug}`);
  }

  console.log(`Done. Updated ${updated} products.`);
}

run().catch((error) => {
  console.error("Failed to backfill product slugs:", error);
  process.exit(1);
});
