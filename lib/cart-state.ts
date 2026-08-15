export type CartItemsMap = Record<string, number>;
export type CartItemSelection = {
  size?: string;
  color?: string;
};
export type CartItemSelectionsMap = Record<string, CartItemSelection>;

const CART_LINE_SEPARATOR = "::";

export type CartLineIdentity = {
  lineId: string;
  productId: string;
  size: string;
  color: string;
};

/** Creates a stable cart-line key so the same product can exist in multiple variants. */
export function createCartLineId(productId: string, size = "", color = ""): string {
  return [productId.trim(), size.trim(), color.trim()]
    .map((part) => encodeURIComponent(part))
    .join(CART_LINE_SEPARATOR);
}

/** Reads both variant-aware keys and legacy product-only cart keys. */
export function parseCartLineId(lineId: string): CartLineIdentity {
  const parts = lineId.split(CART_LINE_SEPARATOR);
  if (parts.length !== 3) {
    return { lineId, productId: lineId.trim(), size: "", color: "" };
  }

  try {
    return {
      lineId,
      productId: decodeURIComponent(parts[0]).trim(),
      size: decodeURIComponent(parts[1]).trim(),
      color: decodeURIComponent(parts[2]).trim(),
    };
  } catch {
    return { lineId, productId: lineId.trim(), size: "", color: "" };
  }
}

export function getProductCartLineIds(items: CartItemsMap, productId: string): string[] {
  return Object.keys(items).filter((lineId) => parseCartLineId(lineId).productId === productId);
}

export function getProductCartQuantity(items: CartItemsMap, productId: string): number {
  return getProductCartLineIds(items, productId).reduce(
    (total, lineId) => total + normalizeQuantity(items[lineId]),
    0
  );
}

const CART_STORAGE_KEY = "nt-cart-items-v1";
const CART_SELECTIONS_STORAGE_KEY = "nt-cart-item-selections-v1";
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

function normalizeSelectionValue(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as { size?: unknown; color?: unknown };
  const size = typeof raw.size === "string" ? raw.size.trim() : "";
  const color = typeof raw.color === "string" ? raw.color.trim() : "";

  if (!size && !color) {
    return null;
  }

  return {
    ...(size ? { size } : {}),
    ...(color ? { color } : {}),
  } satisfies CartItemSelection;
}

function normalizeSelectionsMap(value: unknown): CartItemSelectionsMap {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized: CartItemSelectionsMap = {};
  for (const [productId, selectionRaw] of Object.entries(value)) {
    const safeProductId = productId.trim();
    if (!safeProductId) {
      continue;
    }

    const selection = normalizeSelectionValue(selectionRaw);
    if (!selection) {
      continue;
    }

    normalized[safeProductId] = selection;
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

export function readCartItemSelections(): CartItemSelectionsMap {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(CART_SELECTIONS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    return normalizeSelectionsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function getCartItemsCount(items: CartItemsMap): number {
  return Object.values(items).reduce((total, quantity) => total + normalizeQuantity(quantity), 0);
}

export function writeCartItems(items: CartItemsMap): void {
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

export function writeCartItemSelections(selections: CartItemSelectionsMap): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSelectionsMap(selections);

  try {
    window.localStorage.setItem(CART_SELECTIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(CART_CHANGE_EVENT, {
      detail: {
        items: readCartItems(),
        selections: normalized,
        count: getCartItemsCount(readCartItems()),
      },
    })
  );
}

export function writeCartItemSelection(lineId: string, selection: CartItemSelection | null): void {
  const safeLineId = lineId.trim();
  if (!safeLineId) {
    return;
  }

  const nextSelections = {
    ...readCartItemSelections(),
  };

  const normalizedSelection = normalizeSelectionValue(selection);
  if (!normalizedSelection) {
    delete nextSelections[safeLineId];
  } else {
    nextSelections[safeLineId] = normalizedSelection;
  }

  writeCartItemSelections(nextSelections);
}

export function removeCartItemSelection(lineId: string): void {
  writeCartItemSelection(lineId, null);
}

export function subscribeToCartChanges(listener: (items: CartItemsMap) => void): () => void {
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
