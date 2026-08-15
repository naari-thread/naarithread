"use client";

import type { CartItemSelectionsMap, CartItemsMap } from "@/lib/cart-state";
import type { WishlistItemSelectionsMap, WishlistItemsMap } from "@/lib/wishlist-state";

type ShopState = {
  cart: CartItemsMap;
  wishlist: WishlistItemsMap;
  cartSelections: CartItemSelectionsMap;
  wishlistSelections: WishlistItemSelectionsMap;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPositiveInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function parseCartItems(value: unknown): CartItemsMap {
  if (!isRecord(value)) return {};
  const items: CartItemsMap = {};
  for (const [lineId, quantityRaw] of Object.entries(value)) {
    const quantity = toPositiveInt(quantityRaw);
    if (lineId.trim() && quantity > 0) items[lineId.trim()] = quantity;
  }
  return items;
}

function parseWishlistItems(value: unknown): WishlistItemsMap {
  if (!isRecord(value)) return {};
  const items: WishlistItemsMap = {};
  for (const [productId, selected] of Object.entries(value)) {
    if (productId.trim() && selected === true) items[productId.trim()] = true;
  }
  return items;
}

function parseSelections(value: unknown): Record<string, { size?: string; color?: string }> {
  if (!isRecord(value)) return {};
  const selections: Record<string, { size?: string; color?: string }> = {};
  for (const [itemId, selectionRaw] of Object.entries(value)) {
    if (!itemId.trim() || !isRecord(selectionRaw)) continue;
    const size = typeof selectionRaw.size === "string" ? selectionRaw.size.trim() : "";
    const color = typeof selectionRaw.color === "string" ? selectionRaw.color.trim() : "";
    if (size || color) {
      selections[itemId.trim()] = {
        ...(size ? { size } : {}),
        ...(color ? { color } : {}),
      };
    }
  }
  return selections;
}

function parseShopState(value: unknown): ShopState {
  const record = isRecord(value) ? value : {};
  return {
    cart: parseCartItems(record.cart),
    wishlist: parseWishlistItems(record.wishlist),
    cartSelections: parseSelections(record.cartSelections),
    wishlistSelections: parseSelections(record.wishlistSelections),
  };
}

async function requestShopState(
  jwt: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(`/api/account/shop-state${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Shop-state request failed with status ${response.status}.`);
  }
  return response.json() as Promise<unknown>;
}

export async function readUserCartMap(
  jwt: string,
  userId: string,
): Promise<{ items: CartItemsMap; selections: CartItemSelectionsMap }> {
  void userId;
  try {
    const response = await requestShopState(jwt, "?scope=cart");
    const record = isRecord(response) ? response : {};
    return {
      items: parseCartItems(record.cart),
      selections: parseSelections(record.cartSelections),
    };
  } catch {
    return { items: {}, selections: {} };
  }
}

export async function readUserWishlistMap(
  jwt: string,
  userId: string,
): Promise<{ items: WishlistItemsMap; selections: WishlistItemSelectionsMap }> {
  void userId;
  try {
    const response = await requestShopState(jwt, "?scope=wishlist");
    const record = isRecord(response) ? response : {};
    return {
      items: parseWishlistItems(record.wishlist),
      selections: parseSelections(record.wishlistSelections),
    };
  } catch {
    return { items: {}, selections: {} };
  }
}

export async function upsertUserCartMap(
  jwt: string,
  userId: string,
  items: CartItemsMap,
  selections: CartItemSelectionsMap = {},
): Promise<void> {
  void userId;
  await requestShopState(jwt, "", {
    method: "PUT",
    body: JSON.stringify({ scope: "cart", items, selections }),
  });
}

export async function upsertUserWishlistMap(
  jwt: string,
  userId: string,
  items: WishlistItemsMap,
  selections: WishlistItemSelectionsMap = {},
): Promise<void> {
  void userId;
  await requestShopState(jwt, "", {
    method: "PUT",
    body: JSON.stringify({ scope: "wishlist", items, selections }),
  });
}

export async function mergeLocalAndRemoteShopState(args: {
  jwt: string;
  userId: string;
  localCart: CartItemsMap;
  localWishlist: WishlistItemsMap;
  localCartSelections?: CartItemSelectionsMap;
  localWishlistSelections?: WishlistItemSelectionsMap;
}): Promise<ShopState> {
  const {
    jwt,
    userId,
    localCart,
    localWishlist,
    localCartSelections = {},
    localWishlistSelections = {},
  } = args;
  void userId;

  const response = await requestShopState(jwt, "", {
    method: "POST",
    body: JSON.stringify({
      cart: localCart,
      wishlist: localWishlist,
      cartSelections: localCartSelections,
      wishlistSelections: localWishlistSelections,
    }),
  });
  return parseShopState(response);
}
