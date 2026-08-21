/**
 * Shared Firebase Admin bootstrap + Firestore value (de)serialisation helpers
 * used by the backup / restore / catalog-purge scripts.
 *
 * Credentials are read from `.env` in the repo root, same as every other script
 * in this folder: FIREBASE_SERVICE_ACCOUNT_KEY (single JSON blob) or the
 * FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY triplet.
 */
import { config as loadEnv } from "dotenv";
import { cert, deleteApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, GeoPoint, Timestamp } from "firebase-admin/firestore";

loadEnv({ path: ".env", quiet: true });

/** Every top-level collection the app owns. Keep in sync with lib/firebase/collection-map.ts. */
export const ALL_COLLECTIONS = [
  "banners",
  "carts",
  "catalogMetadata",
  "coupons",
  "notifications",
  "orders",
  "payments",
  "productBadges",
  "products",
  "reviews",
  "sizeCharts",
  "users",
  "walletPayoutRequests",
  "walletTransactions",
  "wallets",
  "wishlists",
];

function env(name) {
  return process.env[name]?.trim() ?? "";
}

/** @returns {{projectId: string, clientEmail: string, privateKey: string}} */
export function firebaseCredential() {
  const serviceAccount = env("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (serviceAccount) {
    const parsed = JSON.parse(serviceAccount);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }
  return {
    projectId: env("FIREBASE_PROJECT_ID"),
    clientEmail: env("FIREBASE_CLIENT_EMAIL"),
    privateKey: env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

/** Boots the Admin SDK and returns `{ db, app, projectId }`. */
export function connect() {
  const credential = firebaseCredential();
  if (!credential.projectId || !credential.clientEmail || !credential.privateKey) {
    throw new Error(
      "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY in .env."
    );
  }
  const app = initializeApp({ credential: cert(credential), projectId: credential.projectId });
  return { app, db: getFirestore(app), projectId: credential.projectId };
}

export async function disconnect() {
  await Promise.all(getApps().map((app) => deleteApp(app)));
}

// ---- value encoding ---------------------------------------------------------
// Firestore documents hold types JSON cannot express (Timestamp, GeoPoint,
// DocumentReference, Bytes). They are encoded as tagged objects so a restore is
// byte-for-byte faithful instead of silently turning timestamps into strings.

export function encodeValue(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Timestamp) {
    return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  if (value instanceof GeoPoint) {
    return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof Buffer) {
    return { __type: "bytes", base64: value.toString("base64") };
  }
  if (typeof value === "object" && typeof value.path === "string" && typeof value.id === "string" && value.firestore) {
    return { __type: "reference", path: value.path };
  }
  if (Array.isArray(value)) return value.map(encodeValue);
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { __type: "number", value: String(value) };
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) out[key] = encodeValue(nested);
    return out;
  }
  return value;
}

export function decodeValue(value, db) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => decodeValue(item, db));
  switch (value.__type) {
    case "timestamp":
      return new Timestamp(value.seconds, value.nanoseconds);
    case "geopoint":
      return new GeoPoint(value.latitude, value.longitude);
    case "bytes":
      return Buffer.from(value.base64, "base64");
    case "reference":
      return db.doc(value.path);
    case "number":
      return Number(value.value);
    default: {
      const out = {};
      for (const [key, nested] of Object.entries(value)) out[key] = decodeValue(nested, db);
      return out;
    }
  }
}

/** Commits `refs`-style operations in chunks that stay under the 500-write batch cap. */
export async function commitInBatches(db, items, apply, chunkSize = 400) {
  let processed = 0;
  for (let index = 0; index < items.length; index += chunkSize) {
    const batch = db.batch();
    for (const item of items.slice(index, index + chunkSize)) apply(batch, item);
    await batch.commit();
    processed += Math.min(chunkSize, items.length - index);
  }
  return processed;
}

/** `argv` helper: `--flag` → true, `--key=value` → "value". */
export function readFlag(name, fallback = undefined) {
  const exact = process.argv.find((arg) => arg === `--${name}`);
  if (exact) return true;
  const pair = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return pair ? pair.slice(name.length + 3) : fallback;
}
