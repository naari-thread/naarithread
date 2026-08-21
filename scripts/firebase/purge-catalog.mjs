/**
 * Cascade-delete dummy/seed products and everything that structurally depends on
 * them, so the client can start adding real products against a clean catalog.
 *
 * DELETED (a dangling reference here would break a live page):
 *   products    – the target docs themselves
 *   reviews     – every review whose productId is a target
 *   carts       – every cart line whose productId (parsed out of the "id::size::color"
 *                 line key) is a target
 *   wishlists   – every wishlist entry whose productId is a target
 *   catalogMetadata/productSearchIndex – rebuilt from the products that survive
 *
 * KEPT ON PURPOSE (self-contained snapshots — safe to keep until payouts clear):
 *   orders, payments, wallets, walletTransactions, notifications, users,
 *   coupons, banners, sizeCharts, productBadges
 *   Order lines carry their own productName/imageUrl/amount snapshot, so past
 *   orders keep rendering after the product doc is gone. The script reports how
 *   many order lines point at deleted products so you know what is now orphaned.
 *
 * Usage:
 *   node scripts/firebase/purge-catalog.mjs --all                       # dry run, whole catalog
 *   node scripts/firebase/purge-catalog.mjs --all --apply               # execute
 *   node scripts/firebase/purge-catalog.mjs --seed-batch=ethnic-seed-2026-07 --apply
 *   node scripts/firebase/purge-catalog.mjs --sku-prefix=ETH-SEED- --apply
 *   node scripts/firebase/purge-catalog.mjs --ids=abc,def --apply
 *
 * Always take a backup first:
 *   node scripts/firebase/backup-firestore.mjs --out=backups/firestore/pre-purge
 */
import { commitInBatches, connect, disconnect, readFlag } from "./_firestore-admin.mjs";

const APPLY = readFlag("apply") === true;
const ALL = readFlag("all") === true;
const SEED_BATCH = typeof readFlag("seed-batch") === "string" ? readFlag("seed-batch") : "";
const SKU_PREFIX = typeof readFlag("sku-prefix") === "string" ? readFlag("sku-prefix") : "";
const IDS = typeof readFlag("ids") === "string"
  ? readFlag("ids").split(",").map((id) => id.trim()).filter(Boolean)
  : [];

const CART_LINE_SEPARATOR = "::";
const VALID_CATEGORIES = new Set(["ethnic-wear", "western-wear", "bottom-wear", "fusion-wear"]);
const VALID_SUBCATEGORIES = new Set([
  "saree", "lehenga", "anarkali", "dresses", "tops", "skirts", "jeans", "trousers-pants",
  "palazzo", "indo-western-dresses", "crop-top-skirt", "kurti-jeans",
]);

/** Mirrors parseCartLineId() in lib/cart-state.ts — cart docs key on "id::size::color". */
function cartLineProductId(lineId) {
  const parts = String(lineId ?? "").split(CART_LINE_SEPARATOR);
  if (parts.length !== 3) return String(lineId ?? "").trim();
  try {
    return decodeURIComponent(parts[0]).trim();
  } catch {
    return String(lineId ?? "").trim();
  }
}

async function selectTargets(db) {
  const snapshot = await db.collection("products").get();
  const docs = snapshot.docs;
  const all = docs.map((document) => ({
    id: document.id,
    sku: String(document.data().sku ?? ""),
    name: String(document.data().name ?? ""),
    seedBatch: String(document.data().seedBatch ?? ""),
  }));

  if (ALL) return { docs, all, targets: all, mode: "all products" };
  if (SEED_BATCH) {
    return { docs, all, targets: all.filter((p) => p.seedBatch === SEED_BATCH), mode: `seedBatch = ${SEED_BATCH}` };
  }
  if (SKU_PREFIX) {
    return { docs, all, targets: all.filter((p) => p.sku.startsWith(SKU_PREFIX)), mode: `sku starts with ${SKU_PREFIX}` };
  }
  if (IDS.length > 0) {
    const wanted = new Set(IDS);
    return { docs, all, targets: all.filter((p) => wanted.has(p.id)), mode: `${IDS.length} explicit id(s)` };
  }
  throw new Error("Pick a selector: --all, --seed-batch=<id>, --sku-prefix=<prefix>, or --ids=a,b,c.");
}

/** Documents in `collection` that reference one of the products being deleted. */
async function findDependents(db, collection, isTarget) {
  const snapshot = await db.collection(collection).get();
  return snapshot.docs.filter((document) => isTarget(document.data()));
}

function buildSearchIndex(products) {
  return products
    .filter((document) => document.data().isActive !== false)
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        name: String(data.name ?? "").trim(),
        slug: String(data.slug ?? "").trim(),
        category: String(data.category ?? "").trim(),
        subCategory: String(data.subCategory ?? data.subcategory ?? "").trim(),
      };
    })
    .filter((entry) =>
      entry.name
      && entry.slug
      && VALID_CATEGORIES.has(entry.category)
      && VALID_SUBCATEGORIES.has(entry.subCategory))
    .sort((first, second) => first.name.localeCompare(second.name));
}

async function main() {
  const { db, projectId } = await connect();
  const { docs, all, targets, mode } = await selectTargets(db);
  const targetIds = new Set(targets.map((product) => product.id));

  if (targetIds.size === 0) {
    console.log(`No products matched (${mode}). Nothing to do.`);
    await disconnect();
    return;
  }

  const [reviews, carts, wishlists, orders] = await Promise.all([
    findDependents(db, "reviews", (data) => targetIds.has(String(data.productId ?? "").trim())),
    findDependents(db, "carts", (data) => targetIds.has(cartLineProductId(data.productId))),
    findDependents(db, "wishlists", (data) => targetIds.has(String(data.productId ?? "").trim())),
    db.collection("orders").get().then((snapshot) => snapshot.docs),
  ]);

  // Orders are kept — only counted, so you can see what became a historical-only reference.
  let orphanedOrderLines = 0;
  let ordersTouched = 0;
  for (const order of orders) {
    let hit = false;
    try {
      const raw = order.data().itemsJson;
      const items = Array.isArray(raw) ? raw : JSON.parse(typeof raw === "string" ? raw : "[]");
      for (const item of Array.isArray(items) ? items : []) {
        if (targetIds.has(String(item?.productId ?? "").trim())) {
          orphanedOrderLines += 1;
          hit = true;
        }
      }
    } catch {
      // Malformed snapshot — audit-catalog-reset.mjs already reports these.
    }
    if (hit) ordersTouched += 1;
  }

  const plan = {
    projectId,
    selector: mode,
    productsTotal: all.length,
    delete: {
      products: targets.length,
      reviews: reviews.length,
      cartLines: carts.length,
      wishlistEntries: wishlists.length,
    },
    keep: {
      orders: orders.length,
      ordersReferencingDeletedProducts: ordersTouched,
      orphanedOrderLines,
    },
    searchIndexEntriesAfter: buildSearchIndex(
      docs.filter((document) => !targetIds.has(document.id))
    ).length,
  };

  console.log(JSON.stringify(plan, null, 2));

  if (!APPLY) {
    console.log("\nDRY RUN — nothing was written. Re-run with --apply to execute.");
    await disconnect();
    return;
  }

  await commitInBatches(db, reviews, (batch, document) => batch.delete(document.ref));
  await commitInBatches(db, carts, (batch, document) => batch.delete(document.ref));
  await commitInBatches(db, wishlists, (batch, document) => batch.delete(document.ref));
  await commitInBatches(db, targets, (batch, product) =>
    batch.delete(db.collection("products").doc(product.id)));

  const entries = buildSearchIndex(docs.filter((document) => !targetIds.has(document.id)));
  await db.collection("catalogMetadata").doc("productSearchIndex").set({
    version: 1,
    updatedAt: new Date().toISOString(),
    products: entries,
  });

  console.log(
    `\nDeleted ${targets.length} product(s), ${reviews.length} review(s), ${carts.length} cart line(s), `
    + `${wishlists.length} wishlist entry(ies). Search index rebuilt with ${entries.length} entry(ies).`
  );
  console.log(
    "Next: redeploy on Vercel (or wait out the 1h catalog cache TTL) so the live site stops serving cached products."
  );
  await disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await disconnect().catch(() => {});
  process.exitCode = 1;
});
