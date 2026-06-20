export type WishlistItemsMap = Record<string, true>;

export type WishlistItemSelection = { size?: string; color?: string };
export type WishlistItemSelectionsMap = Record<string, WishlistItemSelection>;

const WISHLIST_SELECTIONS_KEY = "nt-wishlist-item-selections-v1";

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

export function readWishlistItemSelections(): WishlistItemSelectionsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WISHLIST_SELECTIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: WishlistItemSelectionsMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!k.trim() || !v || typeof v !== "object") continue;
      const item = v as Record<string, unknown>;
      const size = typeof item.size === "string" ? item.size.trim() : "";
      const color = typeof item.color === "string" ? item.color.trim() : "";
      if (size || color) result[k.trim()] = { ...(size ? { size } : {}), ...(color ? { color } : {}) };
    }
    return result;
  } catch {
    return {};
  }
}

export function writeWishlistItemSelection(productId: string, selection: WishlistItemSelection | null) {
  if (typeof window === "undefined") return;
  const safeId = productId.trim();
  if (!safeId) return;
  const current = readWishlistItemSelections();
  if (!selection || (!selection.size && !selection.color)) {
    delete current[safeId];
  } else {
    current[safeId] = { ...(selection.size ? { size: selection.size } : {}), ...(selection.color ? { color: selection.color } : {}) };
  }
  try {
    window.localStorage.setItem(WISHLIST_SELECTIONS_KEY, JSON.stringify(current));
  } catch {}
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
