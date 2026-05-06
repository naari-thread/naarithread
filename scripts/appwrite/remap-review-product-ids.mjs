import { Client, Databases, Query } from "node-appwrite";

const endpoint =
  process.env.APPWRITE_ENDPOINT ??
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  "https://cloud.appwrite.io/v1";
const projectId =
  process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId =
  process.env.APPWRITE_DATABASE_ID ??
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ??
  "naarithread";

const productsCollectionId = "sku";
const reviewsCollectionId = "reviews";
const dryRun = process.argv.includes("--dry-run");

if (!projectId || !apiKey) {
  throw new Error("Missing APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

async function listAllDocuments(collectionId) {
  const all = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await databases.listDocuments(databaseId, collectionId, [
      Query.limit(limit),
      Query.offset(offset),
      Query.orderAsc("$createdAt"),
    ]);
    all.push(...response.documents);
    offset += response.documents.length;
    if (response.documents.length < limit) {
      break;
    }
  }

  return all;
}

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildSkuLookup(products) {
  const byKey = new Map();
  for (const product of products) {
    const productDocId = String(product.$id ?? "").trim();
    const sku = String(product.sku ?? "").trim();
    const slug = String(product.slug ?? "").trim();
    if (!productDocId) continue;

    for (const key of [productDocId, sku, slug]) {
      const normalized = normalize(key);
      if (normalized && !byKey.has(normalized)) {
        byKey.set(normalized, productDocId);
      }
    }
  }
  return byKey;
}

async function main() {
  const [products, reviews] = await Promise.all([
    listAllDocuments(productsCollectionId),
    listAllDocuments(reviewsCollectionId),
  ]);

  const skuLookup = buildSkuLookup(products);
  let updatedCount = 0;
  let alreadyCorrectCount = 0;
  let unresolvedCount = 0;

  for (const review of reviews) {
    const reviewId = String(review.$id ?? "").trim();
    const existingProductId = String(review.productId ?? "").trim();
    const productIdUpperVariant = String(review.productID ?? "").trim();
    const skuVariant = String(review.sku ?? review.productSku ?? "").trim();
    const slugVariant = String(review.slug ?? "").trim();
    const productVariant = String(review.product ?? "").trim();

    const candidates = [
      existingProductId,
      productIdUpperVariant,
      skuVariant,
      slugVariant,
      productVariant,
    ];

    let mappedProductDocId = "";
    for (const candidate of candidates) {
      const found = skuLookup.get(normalize(candidate));
      if (found) {
        mappedProductDocId = found;
        break;
      }
    }

    if (!mappedProductDocId) {
      unresolvedCount += 1;
      console.log(`[UNRESOLVED] review=${reviewId} productId="${existingProductId}"`);
      continue;
    }

    if (mappedProductDocId === existingProductId) {
      alreadyCorrectCount += 1;
      continue;
    }

    updatedCount += 1;
    console.log(
      `${dryRun ? "[DRY-RUN]" : "[UPDATE]"} review=${reviewId} from="${existingProductId}" to="${mappedProductDocId}"`
    );

    if (!dryRun) {
      await databases.updateDocument(databaseId, reviewsCollectionId, reviewId, {
        productId: mappedProductDocId,
      });
    }
  }

  console.log("\nReview productId remap summary");
  console.log(`- Products scanned: ${products.length}`);
  console.log(`- Reviews scanned: ${reviews.length}`);
  console.log(`- Already correct: ${alreadyCorrectCount}`);
  console.log(`- Updated: ${updatedCount}`);
  console.log(`- Unresolved: ${unresolvedCount}`);
  console.log(`- Mode: ${dryRun ? "dry-run" : "live"}`);
}

main().catch((error) => {
  console.error("Failed to remap review product IDs:", error?.message ?? error);
  process.exit(1);
});

