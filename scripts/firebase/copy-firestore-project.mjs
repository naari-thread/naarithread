import { config as loadEnv } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

loadEnv({ path: ".env" });

const COLLECTIONS = [
  "products",
  "users",
  "carts",
  "wishlists",
  "reviews",
  "orders",
  "payments",
  "coupons",
  "banners",
  "wallets",
  "walletTransactions",
  "notifications",
];

function readEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function parseServiceAccount(prefix) {
  const json = readEnv(`${prefix}_FIREBASE_SERVICE_ACCOUNT_KEY`);
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

  const projectId = readEnv(`${prefix}_FIREBASE_PROJECT_ID`);
  const clientEmail = readEnv(`${prefix}_FIREBASE_CLIENT_EMAIL`);
  const privateKey = readEnv(`${prefix}_FIREBASE_PRIVATE_KEY`).replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function parseTargetServiceAccount() {
  const explicitTarget = parseServiceAccount("TARGET");
  if (explicitTarget) return explicitTarget;

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

  const projectId = readEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function requireCredential(label, credential) {
  if (!credential) {
    throw new Error(
      `Missing ${label} Firebase Admin credential. Set ${label.toUpperCase()}_FIREBASE_SERVICE_ACCOUNT_KEY or ${label.toUpperCase()}_FIREBASE_PROJECT_ID/${label.toUpperCase()}_FIREBASE_CLIENT_EMAIL/${label.toUpperCase()}_FIREBASE_PRIVATE_KEY.`
    );
  }
  return credential;
}

function createDb(name, credential) {
  const existing = getApps().find((app) => app.name === name);
  const app =
    existing ??
    initializeApp(
      {
        credential: cert({
          projectId: credential.projectId,
          clientEmail: credential.clientEmail,
          privateKey: credential.privateKey,
        }),
        projectId: credential.projectId,
      },
      name
    );

  return getFirestore(app);
}

async function copyCollection(sourceDb, targetDb, collectionName) {
  const snapshot = await sourceDb.collection(collectionName).get();
  if (snapshot.empty) {
    return { collectionName, copied: 0 };
  }

  let copied = 0;
  let batch = targetDb.batch();
  let pendingWrites = 0;

  for (const document of snapshot.docs) {
    batch.set(targetDb.collection(collectionName).doc(document.id), document.data(), { merge: false });
    copied += 1;
    pendingWrites += 1;

    if (pendingWrites === 450) {
      await batch.commit();
      batch = targetDb.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites > 0) {
    await batch.commit();
  }

  return { collectionName, copied };
}

async function main() {
  const sourceCredential = requireCredential("source", parseServiceAccount("SOURCE"));
  const targetCredential = requireCredential("target", parseTargetServiceAccount());

  if (sourceCredential.projectId === targetCredential.projectId) {
    throw new Error(`Source and target project IDs are both ${sourceCredential.projectId}. Refusing to copy onto itself.`);
  }

  const sourceDb = createDb("source", sourceCredential);
  const targetDb = createDb("target", targetCredential);

  console.log(`Copying Firestore data from ${sourceCredential.projectId} to ${targetCredential.projectId}`);

  const results = [];
  for (const collectionName of COLLECTIONS) {
    const result = await copyCollection(sourceDb, targetDb, collectionName);
    results.push(result);
    console.log(`${result.collectionName}: ${result.copied}`);
  }

  await Promise.all(getApps().map((app) => deleteApp(app)));

  const total = results.reduce((sum, result) => sum + result.copied, 0);
  console.log(`Done. Copied ${total} documents.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
