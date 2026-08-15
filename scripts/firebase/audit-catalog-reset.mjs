import { config as loadEnv } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env", quiet: true });

function env(name) {
  return process.env[name]?.trim() ?? "";
}

function firebaseCredential() {
  const serviceAccount = env("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (serviceAccount) {
    const parsed = JSON.parse(serviceAccount);
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  return {
    projectId: env("FIREBASE_PROJECT_ID"),
    clientEmail: env("FIREBASE_CLIENT_EMAIL"),
    privateKey: env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

async function listAppwriteOrders() {
  const endpoint = (env("APPWRITE_ENDPOINT") || env("NEXT_PUBLIC_APPWRITE_ENDPOINT") || "https://cloud.appwrite.io/v1").replace(/\/$/, "");
  const projectId = env("APPWRITE_PROJECT_ID") || env("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
  const databaseId = env("APPWRITE_DATABASE_ID") || env("NEXT_PUBLIC_APPWRITE_DATABASE_ID") || "naarithread";
  const apiKey = env("APPWRITE_API_KEY");
  if (!projectId || !apiKey) return [];

  const url = new URL(`${endpoint}/databases/${encodeURIComponent(databaseId)}/collections/orders/documents`);
  url.searchParams.append("queries[]", JSON.stringify({ method: "limit", values: [100] }));
  const response = await fetch(url, {
    headers: { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
  });
  if (!response.ok) throw new Error(`Unable to audit Appwrite orders (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload.documents) ? payload.documents : [];
}

function inspectOrderSnapshots(orders) {
  let lines = 0;
  let selfContainedLines = 0;
  let malformedOrders = 0;
  for (const order of orders) {
    try {
      const items = JSON.parse(typeof order.itemsJson === "string" ? order.itemsJson : "[]");
      if (!Array.isArray(items) || items.length === 0) {
        malformedOrders += 1;
        continue;
      }
      for (const item of items) {
        lines += 1;
        if (
          typeof item?.productId === "string"
          && typeof item?.productName === "string"
          && typeof item?.imageUrl === "string"
          && typeof item?.unitAmount === "number"
          && typeof item?.lineAmount === "number"
          && typeof item?.quantity === "number"
        ) selfContainedLines += 1;
      }
    } catch {
      malformedOrders += 1;
    }
  }
  return { orderCount: orders.length, lines, selfContainedLines, malformedOrders };
}

async function main() {
  const credential = firebaseCredential();
  const app = initializeApp({ credential: cert(credential), projectId: credential.projectId });
  const db = getFirestore(app);
  const [products, reviews, index, orders] = await Promise.all([
    db.collection("products").count().get(),
    db.collection("reviews").count().get(),
    db.collection("catalogMetadata").doc("productSearchIndex").get(),
    listAppwriteOrders(),
  ]);
  const indexProducts = index.data()?.products;
  console.log(JSON.stringify({
    firebaseProjectId: credential.projectId,
    firestoreProducts: products.data().count,
    firestoreReviews: reviews.data().count,
    searchIndexEntries: Array.isArray(indexProducts) ? indexProducts.length : 0,
    historicalOrders: inspectOrderSnapshots(orders),
  }, null, 2));
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
