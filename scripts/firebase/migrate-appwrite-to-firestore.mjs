import { config as loadEnv } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env" });

const APPWRITE_COLLECTIONS = [
  { source: "sku", target: "products", required: true },
  { source: "users", target: "users", required: false },
  { source: "carts", target: "carts", required: false },
  { source: "cart", target: "carts", required: false },
  { source: "wishlist", target: "wishlists", required: false },
  { source: "wishlists", target: "wishlists", required: false },
  { source: "reviews", target: "reviews", required: false },
  { source: "review", target: "reviews", required: false },
  { source: "orders", target: "orders", required: false },
  { source: "payments", target: "payments", required: false },
  { source: "coupons", target: "coupons", required: false },
  { source: "banner", target: "banners", required: false },
  { source: "banners", target: "banners", required: false },
  { source: "wallets", target: "wallets", required: false },
  { source: "wallet", target: "wallets", required: false },
  { source: "wallet_transactions", target: "walletTransactions", required: false },
  { source: "walletTransactions", target: "walletTransactions", required: false },
  { source: "notifications", target: "notifications", required: false },
];

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function requireEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function appwriteConfig() {
  return {
    endpoint: (readEnv("APPWRITE_ENDPOINT") || readEnv("NEXT_PUBLIC_APPWRITE_ENDPOINT") || "https://cloud.appwrite.io/v1").replace(/\/$/, ""),
    projectId: readEnv("APPWRITE_PROJECT_ID") || readEnv("NEXT_PUBLIC_APPWRITE_PROJECT_ID"),
    apiKey: readEnv("APPWRITE_API_KEY"),
    databaseId: readEnv("APPWRITE_DATABASE_ID") || readEnv("NEXT_PUBLIC_APPWRITE_DATABASE_ID") || "naarithread",
  };
}

function firebaseCredential() {
  const json = readEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (json) {
    const parsed = JSON.parse(json);
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  return {
    projectId: requireEnv("FIREBASE_PROJECT_ID"),
    clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

function createTargetDb() {
  const credential = firebaseCredential();
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: credential.projectId,
        clientEmail: credential.clientEmail,
        privateKey: credential.privateKey,
      }),
      projectId: credential.projectId,
    });

  return { db: getFirestore(app), projectId: credential.projectId };
}

async function appwriteFetch(config, path, searchParams = null) {
  if (!config.projectId || !config.apiKey) {
    throw new Error("Missing APPWRITE_PROJECT_ID/NEXT_PUBLIC_APPWRITE_PROJECT_ID or APPWRITE_API_KEY.");
  }

  const url = new URL(`${config.endpoint}${path}`);
  if (searchParams) {
    for (const [key, value] of searchParams) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": config.apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Appwrite ${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

async function collectionExists(config, collectionId) {
  try {
    await appwriteFetch(config, `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("404")) return false;
    throw error;
  }
}

async function listDocuments(config, collectionId) {
  const documents = [];
  const limit = 100;
  let offset = 0;

  while (true) {
    const params = [
      ["queries[0]", JSON.stringify({ method: "limit", values: [limit] })],
      ["queries[1]", JSON.stringify({ method: "offset", values: [offset] })],
    ];
    const response = await appwriteFetch(
      config,
      `/databases/${encodeURIComponent(config.databaseId)}/collections/${encodeURIComponent(collectionId)}/documents`,
      params
    );

    const batch = Array.isArray(response.documents) ? response.documents : [];
    documents.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  return documents;
}

function sanitizeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item));
  if (typeof value === "object") {
    return sanitizeDocument(value);
  }
  return value;
}

function sanitizeDocument(document) {
  const output = {};

  for (const [key, value] of Object.entries(document)) {
    if (key === "$id") continue;
    if (key === "$permissions") continue;
    if (key === "$databaseId") continue;
    if (key === "$collectionId") continue;
    if (key === "$createdAt") {
      output.createdAt = value;
      continue;
    }
    if (key === "$updatedAt") {
      output.updatedAt = value;
      continue;
    }
    if (key.startsWith("$")) continue;

    output[key] = sanitizeValue(value);
  }

  return output;
}

async function writeDocuments(db, collectionName, documents) {
  let copied = 0;
  let batch = db.batch();
  let pendingWrites = 0;

  for (const document of documents) {
    const id = String(document.$id ?? "").trim();
    if (!id || id.includes("/")) {
      continue;
    }

    batch.set(db.collection(collectionName).doc(id), sanitizeDocument(document), { merge: false });
    copied += 1;
    pendingWrites += 1;

    if (pendingWrites === 450) {
      await batch.commit();
      batch = db.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  return copied;
}

async function main() {
  const sourceConfig = appwriteConfig();
  const { db, projectId } = createTargetDb();
  const migratedSources = new Set();
  const totals = new Map();

  console.log(`Migrating Appwrite database ${sourceConfig.databaseId} to Firestore project ${projectId}`);

  for (const collection of APPWRITE_COLLECTIONS) {
    if (migratedSources.has(collection.source)) continue;
    migratedSources.add(collection.source);

    const exists = await collectionExists(sourceConfig, collection.source);
    if (!exists) {
      if (collection.required) {
        throw new Error(`Required Appwrite collection ${collection.source} was not found.`);
      }
      console.log(`${collection.source} -> ${collection.target}: skipped, source collection missing`);
      continue;
    }

    const documents = await listDocuments(sourceConfig, collection.source);
    const copied = await writeDocuments(db, collection.target, documents);
    totals.set(collection.target, (totals.get(collection.target) ?? 0) + copied);
    console.log(`${collection.source} -> ${collection.target}: ${copied}`);
  }

  await Promise.all(getApps().map((app) => deleteApp(app)));

  const total = Array.from(totals.values()).reduce((sum, count) => sum + count, 0);
  console.log(`Done. Copied ${total} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
