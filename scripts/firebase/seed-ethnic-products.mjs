/**
 * Seed dummy Ethnic-wear products into the Firestore `products` collection.
 *
 * - Creates 40 items across saree / lehenga / anarkali sub-categories.
 * - Reuses the Cloudinary image URLs already present in the catalog.
 * - Every doc is tagged sku = "ETH-SEED-###" and seedBatch = SEED_BATCH_ID so
 *   the whole batch can be deleted in one query later (see cleanup note below).
 *
 * Usage:
 *   node scripts/firebase/seed-ethnic-products.mjs          # create (skips if batch already present)
 *   node scripts/firebase/seed-ethnic-products.mjs --force  # recreate (deletes old ETH-SEED-* first)
 *
 * Cleanup later:
 *   Delete every doc where sku starts with "ETH-SEED-".
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ---- env loading (minimal .env parser, no dotenv dependency) ----------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env");
const envRaw = readFileSync(envPath, "utf8");
for (const line of envRaw.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (!m) continue;
  let val = m[2];
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (process.env[m[1]] === undefined) process.env[m[1]] = val;
}

if (!getApps()[0]) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}
const db = getFirestore();

const FORCE = process.argv.includes("--force");
const SEED_BATCH_ID = "ethnic-seed-2026-07";
const SKU_PREFIX = "ETH-SEED-";
const TARGET_COUNT = 40;

// ---- reusable image pool (already in the catalog) ---------------------------
const IMAGE_POOL = [
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1781850218/naarithread/products/x6juwiluwornnz1kokjw.jpg",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1781850227/naarithread/products/v7oiwxttaompksfywkcy.jpg",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1781850231/naarithread/products/jkuds9y2ka3j0p8k2i8z.jpg",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146299/2_uecv6t.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146319/1_byc5lz.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146139/2_qhkrc8.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146333/1_pl4iyu.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774145316/1_x6veq2.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146198/5_et1rmm.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146500/1_ye6smw.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774153450/pomelli-image-3_fik7m0.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146155/3_ktinir.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146521/1_hpruxs.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146179/4_vfmdf4.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146393/1_upqovg.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146266/pomelli-image-1_3_rf3glc.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146223/6_euy4pm.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146400/1_vi5avd.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774153423/pomelli-image-2_oq8pji.png",
  "https://res.cloudinary.com/dueruzfoq/image/upload/v1774146385/1_ccdhb3.png",
];

// ---- content pools ----------------------------------------------------------
const COLORS = [
  "Crimson", "Maroon", "Wine", "Emerald", "Bottle Green", "Royal Blue", "Navy",
  "Mustard", "Rani Pink", "Blush Pink", "Ivory", "Off White", "Rust", "Teal",
  "Gold", "Rose Gold", "Peach", "Lavender", "Sea Green", "Coral",
];
const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
const BADGES = ["", "", "", "bestseller", "new-arrival", "festive-edit", "clearance-sale"];

const FABRICS = ["Banarasi silk", "Kanjivaram silk", "organza", "georgette", "chiffon", "art silk", "cotton silk", "velvet", "net"];
const MOTIFS = ["zari", "resham thread", "mirror", "sequin", "gota patti", "chikankari", "bandhani", "block-print"];
const OCCASIONS = ["wedding", "festive", "reception", "sangeet", "puja", "day function"];

const NAME_PARTS = {
  saree: {
    adjectives: ["Heritage", "Regal", "Blossom", "Meenakari", "Paithani", "Kalamkari", "Zariwork", "Temple Border", "Handloom", "Silk Route", "Mughal Garden", "Peacock", "Lotus", "Festive"],
    nouns: ["Silk Saree", "Banarasi Saree", "Organza Saree", "Kanjivaram Saree", "Georgette Saree", "Chiffon Saree"],
  },
  lehenga: {
    adjectives: ["Royal Bridal", "Sabyasachi-inspired", "Mirror Bloom", "Velvet Grandeur", "Rajwadi", "Moonlit", "Golden Dusk", "Rose Court", "Peacock Dance", "Meena", "Zardozi", "Celestial", "Ruby", "Ivory Dream"],
    nouns: ["Lehenga Choli", "Bridal Lehenga", "Flared Lehenga", "Silk Lehenga", "Sequin Lehenga", "Velvet Lehenga"],
  },
  anarkali: {
    adjectives: ["Aangan", "Noor", "Gulmohar", "Shahi", "Chikankari", "Floor-Length", "Layered", "Pastel", "Rooh", "Mehendi", "Zarina", "Frosted", "Amber", "Rani"],
    nouns: ["Anarkali Suit", "Anarkali Gown", "Floor-Length Anarkali", "Anarkali Set", "Kurta Anarkali", "Anarkali Kalidar"],
  },
};

const PRICE_RANGES = {
  saree: { min: 1499, max: 8999 },
  lehenga: { min: 4999, max: 21999 },
  anarkali: { min: 1999, max: 9999 },
};

// ---- deterministic-ish helpers ----------------------------------------------
let seq = 0;
function rand(n) {
  // simple LCG for repeatable-ish variety without extra deps
  seq = (seq * 1103515245 + 12345) & 0x7fffffff;
  return seq % n;
}
function pick(arr) {
  return arr[rand(arr.length)];
}
function pickN(arr, n) {
  const pool = [...arr];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(rand(pool.length), 1)[0]);
  return out;
}
function round99(value) {
  return Math.max(99, Math.round(value / 100) * 100 - 1);
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function buildProduct(subCategory, indexAcrossBatch) {
  const parts = NAME_PARTS[subCategory];
  const name = `${pick(parts.adjectives)} ${pick(parts.nouns)}`;
  const fabric = pick(FABRICS);
  const motif = pick(MOTIFS);
  const occasion = pick(OCCASIONS);
  const colors = pickN(COLORS, 2 + rand(2)); // 2-3 colors
  const sizes = SIZES.slice(0, 3 + rand(3)); // 3-5 sizes from XS..

  const range = PRICE_RANGES[subCategory];
  const originalPrice = round99(range.min + rand(range.max - range.min));
  const discountPct = 10 + rand(41); // 10%–50% off
  const discountPrice = round99(originalPrice * (1 - discountPct / 100));

  const mainImageUrl = IMAGE_POOL[indexAcrossBatch % IMAGE_POOL.length];
  const otherImageUrls = [
    IMAGE_POOL[(indexAcrossBatch + 1) % IMAGE_POOL.length],
    IMAGE_POOL[(indexAcrossBatch + 2) % IMAGE_POOL.length],
  ];

  const skuNumber = String(indexAcrossBatch + 1).padStart(3, "0");
  const sku = `${SKU_PREFIX}${skuNumber}`;
  const slug = `${slugify(name)}-${skuNumber}`;

  const description =
    `Handcrafted ${name.toLowerCase()} in luxe ${fabric} with intricate ${motif} detailing. ` +
    `A statement ${subCategory} piece designed for ${occasion} looks — available in ${colors.join(", ")}. ` +
    `Comfortable, lightweight drape with a premium finish.`;

  const now = new Date().toISOString();

  return {
    name,
    description,
    category: "ethnic-wear",
    subCategory,
    subcategory: subCategory, // legacy lowercase field kept for read compatibility
    mainImageUrl,
    otherImageUrls,
    altImages: otherImageUrls, // legacy field name kept for read compatibility
    originalPrice,
    discountPrice,
    stockQty: 5 + rand(26), // 5-30
    inStock: true,
    rating: 0,
    aggRating: 0,
    ratingCount: 0,
    reviewIds: [],
    colorOptions: colors,
    sizeOptions: sizes,
    size: sizes[0],
    badge: pick(BADGES),
    isActive: true,
    sku,
    slug,
    seed: true,
    seedBatch: SEED_BATCH_ID,
    createdAt: now,
    updatedAt: now,
  };
}

// ---- main -------------------------------------------------------------------
async function deleteExistingSeed() {
  const existing = await db.collection("products").where("seedBatch", "==", SEED_BATCH_ID).get();
  if (existing.empty) return 0;
  let deleted = 0;
  let batch = db.batch();
  let opCount = 0;
  for (const doc of existing.docs) {
    batch.delete(doc.ref);
    opCount += 1;
    deleted += 1;
    if (opCount === 400) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }
  if (opCount > 0) await batch.commit();
  return deleted;
}

async function main() {
  const existing = await db.collection("products").where("seedBatch", "==", SEED_BATCH_ID).get();
  if (!existing.empty && !FORCE) {
    console.log(`Seed batch "${SEED_BATCH_ID}" already exists (${existing.size} docs). Run with --force to recreate.`);
    process.exit(0);
  }
  if (FORCE && !existing.empty) {
    const removed = await deleteExistingSeed();
    console.log(`--force: deleted ${removed} existing seed docs.`);
  }

  // distribution: 14 saree, 13 lehenga, 13 anarkali = 40
  const plan = [
    ...Array(14).fill("saree"),
    ...Array(13).fill("lehenga"),
    ...Array(13).fill("anarkali"),
  ];
  if (plan.length !== TARGET_COUNT) throw new Error(`plan length ${plan.length} != ${TARGET_COUNT}`);

  const usedSlugs = new Set();
  let batch = db.batch();
  let created = 0;

  for (let i = 0; i < plan.length; i += 1) {
    let product = buildProduct(plan[i], i);
    // guarantee unique slug even if name collides
    while (usedSlugs.has(product.slug)) {
      product = { ...product, slug: `${product.slug}-${randomUUID().slice(0, 4)}` };
    }
    usedSlugs.add(product.slug);
    const ref = db.collection("products").doc(randomUUID());
    batch.set(ref, product);
    created += 1;
  }

  await batch.commit();

  // summary
  const bySub = plan.reduce((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
  console.log(`Created ${created} ethnic-wear products.`);
  console.log("By sub-category:", JSON.stringify(bySub));
  console.log(`All tagged: sku prefix "${SKU_PREFIX}", seedBatch "${SEED_BATCH_ID}".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
