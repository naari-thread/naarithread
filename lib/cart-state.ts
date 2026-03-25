export type CartItemsMap = Record<string, number>;

const CART_STORAGE_KEY = "nt-cart-items-v1";
const CART_CHANGE_EVENT = "nt-cart-change";

function normalizeQuantity(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.trunc(parsed));
}

function normalizeCartMap(value: unknown): CartItemsMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized: CartItemsMap = {};
  for (const [productId, quantity] of Object.entries(value)) {
    const safeProductId = productId.trim();
    if (!safeProductId) {
      continue;
    }

    const safeQuantity = normalizeQuantity(quantity);
    if (safeQuantity > 0) {
      normalized[safeProductId] = safeQuantity;
    }
  }

  return normalized;
}

export function readCartItems(): CartItemsMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    return normalizeCartMap(parsed);
  } catch {
    return {};
  }
}

export function getCartItemsCount(items: CartItemsMap): number {
  return Object.values(items).reduce((total, quantity) => total + normalizeQuantity(quantity), 0);
}

export function writeCartItems(items: CartItemsMap) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeCartMap(items);

  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CART_CHANGE_EVENT, {
      detail: {
        items: normalized,
        count: getCartItemsCount(normalized),
      },
    })
  );
}

export function subscribeToCartChanges(listener: (items: CartItemsMap) => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onCartChange = (event: Event) => {
    const custom = event as CustomEvent<{ items?: CartItemsMap }>;
    const items = normalizeCartMap(custom.detail?.items);
    listener(items);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key !== CART_STORAGE_KEY) {
      return;
    }

    listener(readCartItems());
  };

  window.addEventListener(CART_CHANGE_EVENT, onCartChange as EventListener);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CART_CHANGE_EVENT, onCartChange as EventListener);
    window.removeEventListener("storage", onStorage);
  };
}
