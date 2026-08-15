export const FIRESTORE_COLLECTIONS = {
  products: "products",
  users: "users",
  carts: "carts",
  wishlists: "wishlists",
  reviews: "reviews",
  orders: "orders",
  payments: "payments",
  coupons: "coupons",
  banners: "banners",
  wallets: "wallets",
  walletTransactions: "walletTransactions",
  walletPayoutRequests: "walletPayoutRequests",
  notifications: "notifications",
  sizeCharts: "sizeCharts",
  catalogMetadata: "catalogMetadata",
} as const;

const COLLECTION_ALIASES: Record<string, string> = {
  sku: FIRESTORE_COLLECTIONS.products,
  product: FIRESTORE_COLLECTIONS.products,
  products: FIRESTORE_COLLECTIONS.products,
  users: FIRESTORE_COLLECTIONS.users,
  cart: FIRESTORE_COLLECTIONS.carts,
  carts: FIRESTORE_COLLECTIONS.carts,
  wishlist: FIRESTORE_COLLECTIONS.wishlists,
  wishlists: FIRESTORE_COLLECTIONS.wishlists,
  review: FIRESTORE_COLLECTIONS.reviews,
  reviews: FIRESTORE_COLLECTIONS.reviews,
  order: FIRESTORE_COLLECTIONS.orders,
  orders: FIRESTORE_COLLECTIONS.orders,
  payment: FIRESTORE_COLLECTIONS.payments,
  payments: FIRESTORE_COLLECTIONS.payments,
  coupon: FIRESTORE_COLLECTIONS.coupons,
  coupons: FIRESTORE_COLLECTIONS.coupons,
  banner: FIRESTORE_COLLECTIONS.banners,
  banners: FIRESTORE_COLLECTIONS.banners,
  wallet: FIRESTORE_COLLECTIONS.wallets,
  wallets: FIRESTORE_COLLECTIONS.wallets,
  wallet_transactions: FIRESTORE_COLLECTIONS.walletTransactions,
  walletTransactions: FIRESTORE_COLLECTIONS.walletTransactions,
  wallettransactions: FIRESTORE_COLLECTIONS.walletTransactions,
  wallet_payout_requests: FIRESTORE_COLLECTIONS.walletPayoutRequests,
  walletPayoutRequests: FIRESTORE_COLLECTIONS.walletPayoutRequests,
  notifications: FIRESTORE_COLLECTIONS.notifications,
  sizeCharts: FIRESTORE_COLLECTIONS.sizeCharts,
  size_charts: FIRESTORE_COLLECTIONS.sizeCharts,
  catalogMetadata: FIRESTORE_COLLECTIONS.catalogMetadata,
};

export function resolveFirestoreCollection(collectionId: string): string {
  return COLLECTION_ALIASES[collectionId] ?? collectionId;
}

export function appwriteFieldToFirestore(field: string): string {
  if (field === "$id") return "__name__";
  if (field === "$createdAt") return "createdAt";
  if (field === "$updatedAt") return "updatedAt";
  return field;
}
