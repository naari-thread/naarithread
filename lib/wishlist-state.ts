export type WishlistItemsMap = Record<string, true>;

const WISHLIST_STORAGE_KEY = "nt-wishlist-items-v1";
const WISHLIST_CHANGE_EVENT = "nt-wishlist-change";

function normalizeWishlistMap(value: unknown): WishlistItemsMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized: WishlistItemsMap = {};
  for (const productId of Object.keys(value)) {
    const safeProductId = productId.trim();
    if (safeProductId) {
      normalized[safeProductId] = true;
    }
  }

  return normalized;
}

export function readWishlistItems(): WishlistItemsMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return normalizeWishlistMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function getWishlistItemsCount(items: WishlistItemsMap): number {
  return Object.keys(items).length;
}

export function writeWishlistItems(items: WishlistItemsMap) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeWishlistMap(items);

  try {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(WISHLIST_CHANGE_EVENT, {
      detail: {
        items: normalized,
        count: getWishlistItemsCount(normalized),
      },
    })
  );
}

export function toggleWishlistItem(productId: string) {
  const current = readWishlistItems();
  const safeId = productId.trim();
  if (!safeId) {
    return false;
  }

  const next = { ...current };
  if (next[safeId]) {
    delete next[safeId];
    writeWishlistItems(next);
    return false;
  }

  next[safeId] = true;
  writeWishlistItems(next);
  return true;
}

export function subscribeToWishlistChanges(listener: (items: WishlistItemsMap) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onWishlistChange = (event: Event) => {
    const custom = event as CustomEvent<{ items?: WishlistItemsMap }>;
    listener(normalizeWishlistMap(custom.detail?.items));
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== WISHLIST_STORAGE_KEY) {
      return;
    }

    listener(readWishlistItems());
  };

  window.addEventListener(WISHLIST_CHANGE_EVENT, onWishlistChange as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(WISHLIST_CHANGE_EVENT, onWishlistChange as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
