/**
 * Full Firestore backup → local JSON files.
 *
 * Discovers every top-level collection in the project (so nothing is missed if
 * a collection was added outside the code), reads every document, and writes
 * one JSON file per collection plus a manifest with counts.
 *
 * Usage:
 *   node scripts/firebase/backup-firestore.mjs
 *   node scripts/firebase/backup-firestore.mjs --out=backups/firestore/pre-purge
 *   node scripts/firebase/backup-firestore.mjs --deep     # also walk sub-collections
 *   node scripts/firebase/backup-firestore.mjs --auth     # also export Firebase Auth users
 *
 * Output layout:
 *   backups/firestore/<timestamp>/manifest.json
 *   backups/firestore/<timestamp>/products.json      (and one file per collection)
 *   backups/firestore/<timestamp>/_auth-users.json   (with --auth)
 *
 * Restore with: node scripts/firebase/restore-firestore.mjs --from=<folder> --apply
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getAuth } from "firebase-admin/auth";

import { ALL_COLLECTIONS, connect, disconnect, encodeValue, readFlag } from "./_firestore-admin.mjs";

const DEEP = readFlag("deep") === true;
const WITH_AUTH = readFlag("auth") === true;

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function dumpDocument(document, deep) {
  const entry = { id: document.id, data: encodeValue(document.data()) };
  if (!deep) return entry;
  const subcollections = await document.ref.listCollections();
  if (subcollections.length === 0) return entry;
  entry.subcollections = {};
  for (const subcollection of subcollections) {
    const snapshot = await subcollection.get();
    entry.subcollections[subcollection.id] = await Promise.all(
      snapshot.docs.map((child) => dumpDocument(child, deep))
    );
  }
  return entry;
}

async function exportAuthUsers(app) {
  const auth = getAuth(app);
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.map((user) => user.toJSON()));
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function main() {
  const { app, db, projectId } = await connect();
  const outDir = resolve(
    typeof readFlag("out") === "string" ? readFlag("out") : `backups/firestore/${stamp()}`
  );
  mkdirSync(outDir, { recursive: true });

  const discovered = (await db.listCollections()).map((collection) => collection.id);
  const collections = [...new Set([...discovered, ...ALL_COLLECTIONS])].sort();

  const manifest = {
    projectId,
    createdAt: new Date().toISOString(),
    deep: DEEP,
    collections: {},
  };

  for (const name of collections) {
    const snapshot = await db.collection(name).get();
    const documents = [];
    for (const document of snapshot.docs) documents.push(await dumpDocument(document, DEEP));
    writeFileSync(
      resolve(outDir, `${name}.json`),
      `${JSON.stringify({ collection: name, documents }, null, 2)}\n`,
      "utf8"
    );
    manifest.collections[name] = documents.length;
    console.log(`${name}: ${documents.length}`);
  }

  if (WITH_AUTH) {
    const users = await exportAuthUsers(app);
    writeFileSync(resolve(outDir, "_auth-users.json"), `${JSON.stringify(users, null, 2)}\n`, "utf8");
    manifest.authUsers = users.length;
    console.log(`auth users: ${users.length}`);
  }

  writeFileSync(resolve(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const total = Object.values(manifest.collections).reduce((sum, count) => sum + count, 0);
  console.log(`\nBacked up ${total} documents from ${projectId} → ${outDir}`);
  await disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnect().catch(() => {});
  process.exitCode = 1;
});
