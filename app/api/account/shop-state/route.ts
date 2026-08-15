import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import type { CartItemSelectionsMap, CartItemsMap } from "@/lib/cart-state";
import { getUserFromJwt } from "@/lib/appwrite/admin-server";
import { getAdminDb, getBearerToken } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS } from "@/lib/firebase/collection-map";
import type {
  WishlistItemSelectionsMap,
  WishlistItemsMap,
} from "@/lib/wishlist-state";

export const runtime = "nodejs";

const selectionSchema = z
  .object({
    size: z.string().trim().max(40).optional(),
    color: z.string().trim().max(40).optional(),
  })
  .strict();

const cartItemsSchema = z.record(
  z.string().trim().min(1).max(300),
  z.number().int().positive().max(999),
);
const wishlistItemsSchema = z.record(
  z.string().trim().min(1).max(300),
  z.literal(true),
);
const selectionsSchema = z.record(
  z.string().trim().min(1).max(300),
  selectionSchema,
);

const replaceRequestSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("cart"),
    items: cartItemsSchema,
    selections: selectionsSchema.default({}),
  }),
  z.object({
    scope: z.literal("wishlist"),
    items: wishlistItemsSchema,
    selections: selectionsSchema.default({}),
  }),
]);

const mergeRequestSchema = z.object({
  cart: cartItemsSchema.default({}),
  wishlist: wishlistItemsSchema.default({}),
  cartSelections: selectionsSchema.default({}),
  wishlistSelections: selectionsSchema.default({}),
});

type StoredDocument = {
  id: string;
  ref: DocumentReference<DocumentData>;
  data: Record<string, unknown>;
};

type ShopState = {
  cart: CartItemsMap;
  wishlist: WishlistItemsMap;
  cartSelections: CartItemSelectionsMap;
  wishlistSelections: WishlistItemSelectionsMap;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 40) : "";
}

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

function toPositiveInt(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function selectionFields(value: unknown): { size?: string; color?: string } {
  if (!isRecord(value)) return {};
  const size = cleanText(value.size);
  const color = cleanText(value.color);
  return {
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
  };
}

async function listUserDocuments(
  collectionName: string,
  userId: string,
): Promise<StoredDocument[]> {
  const snapshot = await getAdminDb()
    .collection(collectionName)
    .where("userId", "==", userId)
    .limit(500)
    .get();

  return snapshot.docs.map((document) => {
    const rawData: unknown = document.data();
    return {
      id: document.id,
      ref: document.ref,
      data: isRecord(rawData) ? rawData : {},
    };
  });
}

function mapCartDocuments(
  documents: StoredDocument[],
): Pick<ShopState, "cart" | "cartSelections"> {
  const cart: CartItemsMap = {};
  const cartSelections: CartItemSelectionsMap = {};

  for (const document of documents) {
    const lineId = cleanId(document.data.productId);
    const quantity = toPositiveInt(document.data.quantity);
    if (!lineId || quantity <= 0) continue;
    cart[lineId] = quantity;
    const selection = selectionFields(document.data);
    if (selection.size || selection.color) cartSelections[lineId] = selection;
  }

  return { cart, cartSelections };
}

function mapWishlistDocuments(
  documents: StoredDocument[],
): Pick<ShopState, "wishlist" | "wishlistSelections"> {
  const wishlist: WishlistItemsMap = {};
  const wishlistSelections: WishlistItemSelectionsMap = {};

  for (const document of documents) {
    const productId = cleanId(document.data.productId);
    if (!productId) continue;
    wishlist[productId] = true;
    const selection = selectionFields(document.data);
    if (selection.size || selection.color) wishlistSelections[productId] = selection;
  }

  return { wishlist, wishlistSelections };
}

async function reconcileCart(
  userId: string,
  documents: StoredDocument[],
  items: CartItemsMap,
  selections: CartItemSelectionsMap,
): Promise<void> {
  const documentsByLineId = new Map<string, StoredDocument>();
  const duplicateDocuments: StoredDocument[] = [];
  for (const document of documents) {
    const lineId = cleanId(document.data.productId);
    if (!lineId) continue;
    if (documentsByLineId.has(lineId)) duplicateDocuments.push(document);
    else documentsByLineId.set(lineId, document);
  }

  const retainedLineIds = new Set(Object.keys(items));
  const writes: Promise<unknown>[] = duplicateDocuments.map((document) =>
    document.ref.delete(),
  );

  for (const [lineId, quantity] of Object.entries(items)) {
    const selection = selectionFields(selections[lineId]);
    const existing = documentsByLineId.get(lineId);
    if (!existing) {
      writes.push(
        getAdminDb().collection(FIRESTORE_COLLECTIONS.carts).doc().set({
          userId,
          productId: lineId,
          quantity,
          ...selection,
          addedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
      continue;
    }

    const currentSelection = selectionFields(existing.data);
    const unchanged = toPositiveInt(existing.data.quantity) === quantity
      && currentSelection.size === selection.size
      && currentSelection.color === selection.color;
    if (!unchanged) {
      writes.push(existing.ref.update({
        quantity,
        size: selection.size ?? FieldValue.delete(),
        color: selection.color ?? FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
    }
  }

  for (const [lineId, document] of documentsByLineId) {
    if (!retainedLineIds.has(lineId)) writes.push(document.ref.delete());
  }

  await Promise.all(writes);
}

async function reconcileWishlist(
  userId: string,
  documents: StoredDocument[],
  items: WishlistItemsMap,
  selections: WishlistItemSelectionsMap,
): Promise<void> {
  const documentsByProductId = new Map<string, StoredDocument>();
  const duplicateDocuments: StoredDocument[] = [];
  for (const document of documents) {
    const productId = cleanId(document.data.productId);
    if (!productId) continue;
    if (documentsByProductId.has(productId)) duplicateDocuments.push(document);
    else documentsByProductId.set(productId, document);
  }

  const retainedProductIds = new Set(Object.keys(items));
  const writes: Promise<unknown>[] = duplicateDocuments.map((document) =>
    document.ref.delete(),
  );

  for (const productId of Object.keys(items)) {
    const selection = selectionFields(selections[productId]);
    const existing = documentsByProductId.get(productId);
    if (!existing) {
      writes.push(
        getAdminDb().collection(FIRESTORE_COLLECTIONS.wishlists).doc().set({
          userId,
          productId,
          ...selection,
          addedAt: FieldValue.serverTimestamp(),
        }),
      );
      continue;
    }

    const currentSelection = selectionFields(existing.data);
    const changed = currentSelection.size !== selection.size
      || currentSelection.color !== selection.color;
    if (changed) {
      writes.push(existing.ref.update({
        size: selection.size ?? FieldValue.delete(),
        color: selection.color ?? FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }));
    }
  }

  for (const [productId, document] of documentsByProductId) {
    if (!retainedProductIds.has(productId)) writes.push(document.ref.delete());
  }

  await Promise.all(writes);
}

async function readShopState(userId: string): Promise<{
  state: ShopState;
  cartDocuments: StoredDocument[];
  wishlistDocuments: StoredDocument[];
}> {
  const [cartDocuments, wishlistDocuments] = await Promise.all([
    listUserDocuments(FIRESTORE_COLLECTIONS.carts, userId),
    listUserDocuments(FIRESTORE_COLLECTIONS.wishlists, userId),
  ]);
  return {
    state: {
      ...mapCartDocuments(cartDocuments),
      ...mapWishlistDocuments(wishlistDocuments),
    },
    cartDocuments,
    wishlistDocuments,
  };
}

async function authenticate(request: Request): Promise<string | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  const user = await getUserFromJwt(token);
  return user.$id;
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticate(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const scope = new URL(request.url).searchParams.get("scope") ?? "all";
    if (scope === "cart") {
      const documents = await listUserDocuments(FIRESTORE_COLLECTIONS.carts, userId);
      return NextResponse.json(mapCartDocuments(documents));
    }
    if (scope === "wishlist") {
      const documents = await listUserDocuments(FIRESTORE_COLLECTIONS.wishlists, userId);
      return NextResponse.json(mapWishlistDocuments(documents));
    }
    if (scope !== "all") {
      return NextResponse.json({ error: "Invalid shop-state scope." }, { status: 400 });
    }
    const { state } = await readShopState(userId);
    return NextResponse.json(state);
  } catch (error) {
    console.error("[shop-state] read failed", error);
    return NextResponse.json({ error: "Unable to load shop state." }, { status: 500 });
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticate(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = replaceRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid shop-state payload." }, { status: 400 });
    }

    if (parsed.data.scope === "cart") {
      const documents = await listUserDocuments(FIRESTORE_COLLECTIONS.carts, userId);
      await reconcileCart(userId, documents, parsed.data.items, parsed.data.selections);
    } else {
      const documents = await listUserDocuments(FIRESTORE_COLLECTIONS.wishlists, userId);
      await reconcileWishlist(userId, documents, parsed.data.items, parsed.data.selections);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[shop-state] replace failed", error);
    return NextResponse.json({ error: "Unable to save shop state." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const userId = await authenticate(request);
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = mergeRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid shop-state payload." }, { status: 400 });
    }

    const { state: remote, cartDocuments, wishlistDocuments } = await readShopState(userId);
    const cart: CartItemsMap = { ...remote.cart };
    for (const [lineId, quantity] of Object.entries(parsed.data.cart)) {
      cart[lineId] = Math.max(quantity, toPositiveInt(remote.cart[lineId]));
    }
    const wishlist: WishlistItemsMap = { ...remote.wishlist, ...parsed.data.wishlist };
    const cartSelections: CartItemSelectionsMap = {
      ...remote.cartSelections,
      ...parsed.data.cartSelections,
    };
    const wishlistSelections: WishlistItemSelectionsMap = {
      ...remote.wishlistSelections,
      ...parsed.data.wishlistSelections,
    };

    await Promise.all([
      reconcileCart(userId, cartDocuments, cart, cartSelections),
      reconcileWishlist(userId, wishlistDocuments, wishlist, wishlistSelections),
    ]);

    return NextResponse.json({ cart, wishlist, cartSelections, wishlistSelections });
  } catch (error) {
    console.error("[shop-state] merge failed", error);
    return NextResponse.json({ error: "Unable to synchronize shop state." }, { status: 500 });
  }
}
