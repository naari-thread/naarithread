import { config as loadEnv } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env", quiet: true });

const CATEGORIES = new Set(["ethnic-wear", "western-wear", "bottom-wear", "fusion-wear"]);
const SUBCATEGORIES = new Set([
  "saree", "lehenga", "anarkali", "dresses", "tops", "skirts", "jeans", "trousers-pants",
  "palazzo", "indo-western-dresses", "crop-top-skirt", "kurti-jeans",
]);

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function credential() {
  const json = readEnv("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (json) {
    const parsed = JSON.parse(json);
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  return {
    projectId: readEnv("FIREBASE_PROJECT_ID"),
    clientEmail: readEnv("FIREBASE_CLIENT_EMAIL"),
    privateKey: readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

async function main() {
  const account = credential();
  const app = initializeApp({ credential: cert(account), projectId: account.projectId });
  const db = getFirestore(app);
  const snapshot = await db.collection("products").get();
  const entries = snapshot.docs.flatMap((document) => {
    const data = document.data();
    const name = String(data.name ?? "").trim();
    const slug = String(data.slug ?? "").trim();
    const category = String(data.category ?? "").trim();
    const subCategory = String(data.subCategory ?? data.subcategory ?? "").trim();
    if (data.isActive === false || !name || !slug || !CATEGORIES.has(category) || !SUBCATEGORIES.has(subCategory)) return [];
    return [{ id: document.id, name, slug, category, subCategory }];
  }).sort((first, second) => first.name.localeCompare(second.name));
  await db.collection("catalogMetadata").doc("productSearchIndex").set({
    version: 1,
    updatedAt: new Date().toISOString(),
    products: entries,
  });
  console.log(`Indexed ${entries.length} active products (${snapshot.size - entries.length} excluded).`);
  await Promise.all(getApps().map((firebaseApp) => deleteApp(firebaseApp)));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
