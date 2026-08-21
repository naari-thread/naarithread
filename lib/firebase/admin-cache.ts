/**
 * Cached Firestore reads for the /admin dashboard.
 *
 * The admin page is rendered fresh on every navigation, so without this layer a
 * single visit re-reads the whole catalog (once for the product grid, again for
 * the create/edit form dropdowns) plus the recent orders and payments. On the
 * Firebase Spark plan that burns the daily read quota very quickly as the
 * catalog grows.
 *
 * Freshness is exact rather than eventual: every write path invalidates the tag
 * it affects, so the admin always sees their own change immediately.
 *   - catalog writes  -> `PRODUCT_CATALOG_CACHE_TAG` (see revalidateProductSurfaces)
 *   - order writes    -> `ADMIN_ORDERS_CACHE_TAG`    (see invalidateAdminOrdersCache)
 *   - payment writes  -> `ADMIN_PAYMENTS_CACHE_TAG`  (see invalidateAdminPaymentsCache)
 *
 * The short `revalidate` values are a backstop only, in case a future write path
 * forgets to invalidate. They are not the primary freshness mechanism.
 */
import { revalidateTag, unstable_cache } from "next/cache";

import {
  ADMIN_ORDERS_CACHE_TAG,
  ADMIN_PAYMENTS_CACHE_TAG,
  PRODUCT_CATALOG_CACHE_TAG,
} from "@/lib/cache-tags";
import { getAdminDb } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import { timestampToIso } from "@/lib/firebase/document";

/** Cached values must be JSON-serialisable, so Firestore documents are flattened first. */
export type AdminDocument = Record<string, unknown> & { $id: string; $createdAt: string };

export type AdminPaymentStatusSummary = {
  paid: number;
  failed: number;
  created: number;
  refundedToWallet: number;
};

/** Upper bound on the catalog we hold in one cache entry. Past this, move to cursor paging. */
const PRODUCT_LIST_LIMIT = 2000;
/** How many recent orders / payments the dashboard lists before filtering. */
const TRANSACTION_LIST_LIMIT = 100;
/** Backstop only — tag invalidation is what keeps these caches correct. */
const CATALOG_REVALIDATE_SECONDS = 3600;
const TRANSACTION_REVALIDATE_SECONDS = 60;

type TimestampLike = { toDate: () => Date };

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

/** Recursively replaces Firestore Timestamps with ISO strings so the value can be cached. */
function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = serializeValue(nested);
    }
    return output;
  }
  return value;
}

function toAdminDocument(id: string, data: Record<string, unknown>): AdminDocument {
  const serialized = serializeValue(data) as Record<string, unknown>;
  return { ...serialized, $id: id, $createdAt: timestampToIso(data.createdAt) };
}

async function readAdminProducts(): Promise<AdminDocument[]> {
  const snapshot = await getAdminDb()
    .collection(FIRESTORE_COLLECTIONS.products)
    .limit(PRODUCT_LIST_LIMIT)
    .get();
  return snapshot.docs.map((document) => toAdminDocument(document.id, document.data()));
}

/**
 * Every product, for the admin grid, search and the create/edit form dropdowns.
 * Invalidated by `revalidateProductSurfaces()` on any catalog write.
 */
export const getCachedAdminProducts = unstable_cache(readAdminProducts, ["admin-products-v1"], {
  tags: [PRODUCT_CATALOG_CACHE_TAG],
  revalidate: CATALOG_REVALIDATE_SECONDS,
});

async function readRecentTransactions(collection: string): Promise<AdminDocument[]> {
  const snapshot = await getAdminDb()
    .collection(collection)
    .orderBy("createdAt", "desc")
    .limit(TRANSACTION_LIST_LIMIT)
    .get();
  return snapshot.docs.map((document) => toAdminDocument(document.id, document.data()));
}

/** The most recent orders. Invalidated whenever an order is created or its status changes. */
export const getCachedAdminOrders = unstable_cache(
  () => readRecentTransactions(FIRESTORE_COLLECTIONS.orders),
  ["admin-orders-v1"],
  { tags: [ADMIN_ORDERS_CACHE_TAG], revalidate: TRANSACTION_REVALIDATE_SECONDS }
);

async function countPaymentsByStatus(status: string): Promise<number> {
  try {
    const snapshot = await getAdminDb()
      .collection(FIRESTORE_COLLECTIONS.payments)
      .where("status", "==", status)
      .count()
      .get();
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

async function readAdminPayments(): Promise<{
  documents: AdminDocument[];
  summary: AdminPaymentStatusSummary;
}> {
  const [documents, paid, failed, created, refundedToWallet] = await Promise.all([
    readRecentTransactions(FIRESTORE_COLLECTIONS.payments),
    countPaymentsByStatus("paid"),
    countPaymentsByStatus("failed"),
    countPaymentsByStatus("created"),
    countPaymentsByStatus("refunded_to_wallet"),
  ]);

  return { documents, summary: { paid, failed, created, refundedToWallet } };
}

/** Recent payments plus the status counters shown above the table. */
export const getCachedAdminPayments = unstable_cache(readAdminPayments, ["admin-payments-v1"], {
  tags: [ADMIN_PAYMENTS_CACHE_TAG],
  revalidate: TRANSACTION_REVALIDATE_SECONDS,
});

/**
 * Call from every route that writes an order document so the dashboard reflects
 * the change on the admin's very next render.
 */
export function invalidateAdminOrdersCache(): void {
  revalidateTag(ADMIN_ORDERS_CACHE_TAG, { expire: 0 });
}

/** Call from every route that writes a payment document. */
export function invalidateAdminPaymentsCache(): void {
  revalidateTag(ADMIN_PAYMENTS_CACHE_TAG, { expire: 0 });
}

/** Convenience for checkout / refund paths that touch an order and its payment together. */
export function invalidateAdminTransactionCaches(): void {
  invalidateAdminOrdersCache();
  invalidateAdminPaymentsCache();
}
