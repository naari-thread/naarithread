/**
 * Restore a Firestore backup produced by backup-firestore.mjs.
 *
 * Documents are written back with their original IDs, so restoring is
 * idempotent: existing docs are overwritten, missing docs are recreated.
 * Nothing is deleted unless --wipe is passed.
 *
 * Usage:
 *   node scripts/firebase/restore-firestore.mjs --from=backups/firestore/<ts>            # dry run
 *   node scripts/firebase/restore-firestore.mjs --from=backups/firestore/<ts> --apply
 *   node scripts/firebase/restore-firestore.mjs --from=<dir> --apply --only=products,reviews
 *   node scripts/firebase/restore-firestore.mjs --from=<dir> --apply --wipe              # delete-then-restore
 *
 * Safety: refuses to run if the backup manifest's projectId differs from the
 * credentials in .env, unless --force-project is passed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { commitInBatches, connect, decodeValue, disconnect, readFlag } from "./_firestore-admin.mjs";

const FROM = typeof readFlag("from") === "string" ? readFlag("from") : "";
const APPLY = readFlag("apply") === true;
const WIPE = readFlag("wipe") === true;
const FORCE_PROJECT = readFlag("force-project") === true;
const ONLY = typeof readFlag("only") === "string"
  ? readFlag("only").split(",").map((name) => name.trim()).filter(Boolean)
  : null;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function restoreDocuments(db, collectionRef, documents) {
  await commitInBatches(db, documents, (batch, document) => {
    batch.set(collectionRef.doc(document.id), decodeValue(document.data, db), { merge: false });
  });
  // Sub-collections are written after the parents so parent docs always exist first.
  for (const document of documents) {
    for (const [name, children] of Object.entries(document.subcollections ?? {})) {
      await restoreDocuments(db, collectionRef.doc(document.id).collection(name), children);
    }
  }
}

async function wipeCollection(db, name) {
  const snapshot = await db.collection(name).get();
  await commitInBatches(db, snapshot.docs, (batch, document) => batch.delete(document.ref));
  return snapshot.size;
}

async function main() {
  if (!FROM) throw new Error("Pass --from=<backup folder>.");
  const dir = resolve(FROM);
  const manifestPath = resolve(dir, "manifest.json");
  if (!existsSync(manifestPath)) throw new Error(`No manifest.json in ${dir}.`);
  const manifest = readJson(manifestPath);

  const { db, projectId } = await connect();
  if (manifest.projectId !== projectId && !FORCE_PROJECT) {
    throw new Error(
      `Backup is from project "${manifest.projectId}" but .env points at "${projectId}". Pass --force-project to override.`
    );
  }

  const names = Object.keys(manifest.collections)
    .filter((name) => (ONLY ? ONLY.includes(name) : true))
    .sort();

  console.log(`${APPLY ? "Restoring" : "DRY RUN — would restore"} into ${projectId} from ${dir}`);

  for (const name of names) {
    const file = resolve(dir, `${name}.json`);
    if (!existsSync(file)) {
      console.log(`${name}: skipped (file missing)`);
      continue;
    }
    const { documents } = readJson(file);
    if (!APPLY) {
      console.log(`${name}: ${documents.length} document(s)${WIPE ? " (after wipe)" : ""}`);
      continue;
    }
    const wiped = WIPE ? await wipeCollection(db, name) : 0;
    await restoreDocuments(db, db.collection(name), documents);
    console.log(`${name}: restored ${documents.length}${WIPE ? ` (wiped ${wiped} first)` : ""}`);
  }

  if (!APPLY) console.log("\nNothing written. Re-run with --apply to execute.");
  else console.log("\nRestore complete. Redeploy (or wait for the 1h cache TTL) so the app re-reads the catalog.");
  await disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnect().catch(() => {});
  process.exitCode = 1;
});
