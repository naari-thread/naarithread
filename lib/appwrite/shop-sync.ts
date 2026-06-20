"use client";

import { ID, Permission, Query, Role, type Models } from "appwrite";

import { appwritePublicConfig } from "@/lib/appwrite/constants";
import { getBrowserDatabases } from "@/lib/appwrite/client";
import type { CartItemsMap } from "@/lib/cart-state";
import type { WishlistItemsMap } from "@/lib/wishlist-state";

type CartDocument = Models.Document & {
  userId: string;
  productId: string;
  quantity: number;
};

type WishlistDocument = Models.Document & {
  userId: string;
  productId: string;
};

const CART_COLLECTION_CANDIDATES = ["carts", "cart"] as const;
const WISHLIST_COLLECTION_CANDIDATES = ["wishlist", "wishlists"] as const;

function toPositiveInt(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

function resolveCollectionId(candidates: readonly string[]): string {
  // Firebase aliases map legacy and canonical names to the same collection.
  // Probing a protected collection without an ownership query is denied by design.
  return candidates[0];
}

async function listUserCartDocs(jwt: string, userId: string) {
  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return [] as CartDocument[];
  }

  const collectionId = resolveCollectionId(CART_COLLECTION_CANDIDATES);

  const list = await databases.listDocuments<CartDocument>(
    appwritePublicConfig.databaseId,
    collectionId,
    [Query.equal("userId", userId), Query.limit(500)]
  );

  return list.documents;
}

async function listUserWishlistDocs(jwt: string, userId: string) {
  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return [] as WishlistDocument[];
  }

  const collectionId = resolveCollectionId(WISHLIST_COLLECTION_CANDIDATES);

  const list = await databases.listDocuments<WishlistDocument>(
    appwritePublicConfig.databaseId,
    collectionId,
    [Query.equal("userId", userId), Query.limit(500)]
  );

  return list.documents;
}

export async function readUserCartMap(jwt: string, userId: string) {
  try {
    const docs = await listUserCartDocs(jwt, userId);
    const items: CartItemsMap = {};

    for (const doc of docs) {
      const productId = String(doc.productId ?? "").trim();
      if (!productId) {
        continue;
      }

      const quantity = toPositiveInt(doc.quantity);
      if (quantity > 0) {
        items[productId] = quantity;
      }
    }

    return items;
  } catch {
    return {} as CartItemsMap;
  }
}

export async function readUserWishlistMap(jwt: string, userId: string) {
  try {
    const docs = await listUserWishlistDocs(jwt, userId);
    const items: WishlistItemsMap = {};

    for (const doc of docs) {
      const productId = String(doc.productId ?? "").trim();
      if (productId) {
        items[productId] = true;
      }
    }

    return items;
  } catch {
    return {} as WishlistItemsMap;
  }
}

export async function upsertUserCartMap(jwt: string, userId: string, items: CartItemsMap) {
  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return;
  }

  const collectionId = resolveCollectionId(CART_COLLECTION_CANDIDATES);

  const existing = await listUserCartDocs(jwt, userId);
  const existingByProduct = new Map(existing.map((doc) => [doc.productId, doc] as const));
  const retainedProductIds = new Set(
    Object.entries(items)
      .filter(([, quantity]) => toPositiveInt(quantity) > 0)
      .map(([productId]) => productId)
  );

  for (const [productId, quantityRaw] of Object.entries(items)) {
    const quantity = toPositiveInt(quantityRaw);
    if (quantity <= 0) {
      continue;
    }

    const doc = existingByProduct.get(productId);

    if (doc) {
      await databases.updateDocument(appwritePublicConfig.databaseId, collectionId, doc.$id, {
        quantity,
        updatedAt: new Date().toISOString(),
      });
      continue;
    }

    await databases.createDocument(
      appwritePublicConfig.databaseId,
      collectionId,
      ID.unique(),
      {
        userId,
        productId,
        quantity,
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
  }

  await Promise.all(
    existing
      .filter((doc) => !retainedProductIds.has(doc.productId))
      .map((doc) => databases.deleteDocument(appwritePublicConfig.databaseId, collectionId, doc.$id))
  );
}

export async function upsertUserWishlistMap(jwt: string, userId: string, items: WishlistItemsMap) {
  const databases = getBrowserDatabases(jwt);
  if (!databases || !appwritePublicConfig.databaseId) {
    return;
  }

  const collectionId = resolveCollectionId(WISHLIST_COLLECTION_CANDIDATES);

  const existing = await listUserWishlistDocs(jwt, userId);
  const existingByProduct = new Map(existing.map((doc) => [doc.productId, doc] as const));
  const retainedProductIds = new Set(Object.keys(items).filter((productId) => productId.trim()));

  for (const productId of Object.keys(items)) {
    if (!productId.trim() || existingByProduct.has(productId)) {
      continue;
    }

    await databases.createDocument(
      appwritePublicConfig.databaseId,
      collectionId,
      ID.unique(),
      {
        userId,
        productId,
        addedAt: new Date().toISOString(),
      },
      [
        Permission.read(Role.user(userId)),
        Permission.update(Role.user(userId)),
        Permission.delete(Role.user(userId)),
      ]
    );
  }

  await Promise.all(
    existing
      .filter((doc) => !retainedProductIds.has(doc.productId))
      .map((doc) => databases.deleteDocument(appwritePublicConfig.databaseId, collectionId, doc.$id))
  );
}

export async function mergeLocalAndRemoteShopState(args: {
  jwt: string;
  userId: string;
  localCart: CartItemsMap;
  localWishlist: WishlistItemsMap;
}) {
  const { jwt, userId, localCart, localWishlist } = args;

  const remoteCart = await readUserCartMap(jwt, userId);
  const remoteWishlist = await readUserWishlistMap(jwt, userId);

  const mergedCart: CartItemsMap = { ...remoteCart };
  for (const [productId, quantityRaw] of Object.entries(localCart)) {
    const quantity = toPositiveInt(quantityRaw);
    if (quantity <= 0) {
      continue;
    }

    mergedCart[productId] = Math.max(quantity, toPositiveInt(remoteCart[productId]));
  }

  const mergedWishlist: WishlistItemsMap = { ...remoteWishlist, ...localWishlist };

  await Promise.all([
    upsertUserCartMap(jwt, userId, mergedCart),
    upsertUserWishlistMap(jwt, userId, mergedWishlist),
  ]);

  return {
    cart: mergedCart,
    wishlist: mergedWishlist,
  };
}
