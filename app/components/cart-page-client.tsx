"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { AuthModal } from "@/app/components/auth-modal";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { useAuth } from "@/app/components/auth-provider";
import type { ProductRecord } from "@/lib/appwrite/products";
import {
  readCartItemSelections,
  readCartItems,
  removeCartItemSelection,
  writeCartItems,
  type CartItemSelectionsMap,
  type CartItemsMap,
} from "@/lib/cart-state";
import { readUserCartMap, upsertUserCartMap } from "@/lib/appwrite/shop-sync";
import {
  areProductsEquivalent,
  fetchCatalogProductsFromApi,
  readCachedProductSnapshot,
  writeCachedProductSnapshot,
} from "@/lib/product-catalog-cache";

type CartLine = {
  product: ProductRecord;
  quantity: number;
};

type MissingCartLine = {
  productId: string;
  quantity: number;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CartPageClient() {
  const { user, isLoading, isAuthenticated, createAuthJwt } = useAuth();
  const [cartItems, setCartItems] = useState<CartItemsMap>({});
  const [cartSelections, setCartSelections] = useState<CartItemSelectionsMap>({});
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [hasCompletedCatalogSync, setHasCompletedCatalogSync] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCartItems(readCartItems());
      setCartSelections(readCartItemSelections());
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const cachedProducts = readCachedProductSnapshot();

    if (cachedProducts.length > 0) {
      setProducts(cachedProducts);
    }

    const controller = new AbortController();

    const hydrateCatalog = async () => {
      try {
        const serverProducts = await fetchCatalogProductsFromApi(controller.signal);
        if (!alive || serverProducts.length === 0) {
          return;
        }

        if (!areProductsEquivalent(serverProducts, cachedProducts)) {
          setProducts(serverProducts);
          writeCachedProductSnapshot(serverProducts);
        }
      } finally {
        if (alive) {
          setHasCompletedCatalogSync(true);
        }
      }
    };

    void hydrateCatalog();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const hydrateFromCloud = async () => {
      if (!isAuthenticated || !user?.$id) {
        return;
      }

      try {
        const jwt = await createAuthJwt();
        const cloudCart = await readUserCartMap(jwt, user.$id);
        if (!alive || Object.keys(cloudCart).length === 0) {
          return;
        }

        const merged = { ...cloudCart, ...readCartItems() };
        writeCartItems(merged);
        setCartItems(merged);
      } catch {
        // Local cart remains source of truth on temporary sync failure.
      }
    };

    void hydrateFromCloud();

    return () => {
      alive = false;
    };
  }, [createAuthJwt, isAuthenticated, user?.$id]);

  const { lines, missingLines } = useMemo(() => {
    const byId = new Map(products.map((item) => [item.id, item] as const));
    const resolvedLines: CartLine[] = [];
    const unresolvedLines: MissingCartLine[] = [];

    for (const [productId, quantity] of Object.entries(cartItems)) {
      if (quantity <= 0) {
        continue;
      }

      const product = byId.get(productId);
      if (!product) {
        unresolvedLines.push({ productId, quantity });
        continue;
      }

      resolvedLines.push({
        product,
        quantity,
      });
    }

    return {
      lines: resolvedLines,
      missingLines: unresolvedLines,
    };
  }, [cartItems, products]);

  const subtotal = lines.reduce((total, line) => {
    const sellingPrice = line.product.discountPrice > 0 ? line.product.discountPrice : line.product.originalPrice;
    return total + sellingPrice * line.quantity;
  }, 0);

  const originalTotal = lines.reduce((total, line) => total + line.product.originalPrice * line.quantity, 0);
  const discount = Math.max(0, originalTotal - subtotal);
  const delivery = lines.length === 0 || subtotal > 2999 ? 0 : 99;
  const total = subtotal + delivery;

  const persistCart = async (nextItems: CartItemsMap) => {
    setCartItems(nextItems);
    writeCartItems(nextItems);

    if (!isAuthenticated || !user?.$id) {
      return;
    }

    try {
      const jwt = await createAuthJwt();
      await upsertUserCartMap(jwt, user.$id, nextItems);
    } catch {
      // Keep local updates responsive if cloud write fails.
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    const next = { ...cartItems };
    const normalized = Math.max(0, Math.min(99, Math.trunc(quantity)));

    if (normalized <= 0) {
      delete next[productId];
      removeCartItemSelection(productId);
      setCartSelections((previous) => {
        const rest = { ...previous };
        delete rest[productId];
        return rest;
      });
    } else {
      next[productId] = normalized;
    }

    await persistCart(next);
  };

  return (
    <>
      <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-16 md:pt-30">
        <section className="mx-auto w-full max-w-6xl">
          <header className={`pb-6 ${isLoading || isAuthenticated ? 'border-b border-primary/15' : ''}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Checkout</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Cart</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/82 sm:text-base">
              Review your selected items and proceed with secure checkout.
            </p>
          </header>

          {!isLoading && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-y border-primary/15 py-5 text-sm text-primary/80"
            >
              <span>You are using local cart storage. Sign in to keep your cart synced and safe across devices.</span>
              <button
                type="button"
                aria-label="Sign in to sync cart"
                onClick={() => setIsAuthModalOpen(true)}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90"
              >
                Sign in
              </button>
            </motion.div>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-12">
            <div className="flex flex-col">
              {lines.length === 0 && missingLines.length === 0 ? (
                <div className="py-12 text-center text-sm text-primary/75">
                  Your cart is empty. Add products from the catalog to continue.
                </div>
              ) : null}

              {lines.map((line) => {
                const sellingPrice = line.product.discountPrice > 0 ? line.product.discountPrice : line.product.originalPrice;

                return (
                  <article key={line.product.id} className="flex flex-col gap-6 border-b border-primary/10 py-6 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-start sm:items-center gap-5">
                      <Link
                        href={`/products/${line.product.category}/${line.product.subCategory}/${line.product.slug}`}
                        className="relative h-28 w-24 sm:h-32 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-primary/5 transition hover:opacity-90"
                      >
                        {line.product.mainImageUrl ? (
                          <CloudinaryImage
                            src={line.product.mainImageUrl}
                            alt={line.product.name}
                            fill
                            sizes="(max-width: 768px) 112px, 112px"
                            className="object-cover object-top"
                          />
                        ) : null}
                      </Link>

                      <div className="flex flex-col">
                        <Link href={`/products/${line.product.category}/${line.product.subCategory}/${line.product.slug}`} className="hover:underline">
                          <h2 className="text-base font-semibold sm:text-lg">{line.product.name}</h2>
                        </Link>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/65">
                          {line.product.categoryValue} • {line.product.subCategoryValue}
                        </p>
                        {(cartSelections[line.product.id]?.size || cartSelections[line.product.id]?.color) ? (
                          <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-primary/60">
                            {cartSelections[line.product.id]?.size ? `Size: ${cartSelections[line.product.id]?.size}` : ""}
                            {cartSelections[line.product.id]?.size && cartSelections[line.product.id]?.color ? "  •  " : ""}
                            {cartSelections[line.product.id]?.color ? `Color: ${cartSelections[line.product.id]?.color}` : ""}
                          </p>
                        ) : null}
                        
                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-base font-semibold">₹{sellingPrice.toLocaleString("en-IN")}</span>
                          {line.product.originalPrice > sellingPrice && (
                            <span className="text-xs text-primary/55 line-through">₹{line.product.originalPrice.toLocaleString("en-IN")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 sm:w-40 shrink-0 sm:gap-4">
                      <div className="flex h-10 items-center justify-between gap-2 rounded-full border border-primary/20 px-2 bg-primary/5 w-full">
                        <button
                          type="button"
                          aria-label={`Decrease ${line.product.name} quantity`}
                          onClick={() => void updateQuantity(line.product.id, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-primary/10"
                        >
                          <DynamicHugeIcon name="Remove01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden={true} />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${line.product.name} quantity`}
                          onClick={() => void updateQuantity(line.product.id, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-primary/10"
                        >
                          <DynamicHugeIcon name="Add01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden={true} />
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${line.product.name} from cart`}
                        onClick={() => void updateQuantity(line.product.id, 0)}
                        className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary/20 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}

              {missingLines.map((line) =>
                hasCompletedCatalogSync ? (
                  <article key={line.productId} className="flex flex-col gap-4 border-b border-primary/10 py-6">
                    <div className="rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
                      <p className="text-sm font-medium text-primary">Product unavailable</p>
                      <p className="mt-1 text-xs text-primary/70">
                        This item could not be loaded right now. You can remove it from your cart.
                      </p>
                      <p className="mt-2 text-xs text-primary/70">Quantity: {line.quantity}</p>
                      <button
                        type="button"
                        aria-label="Remove unavailable item from cart"
                        onClick={() => void updateQuantity(line.productId, 0)}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-primary/20 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ) : (
                  <article key={line.productId} className="flex flex-col gap-6 border-b border-primary/10 py-6" aria-hidden={true}>
                    <div className="flex flex-1 items-start gap-5">
                      <div className="h-28 w-24 shrink-0 animate-pulse rounded-xl bg-primary/10 sm:h-32 sm:w-28" />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-primary/10" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-primary/10" />
                        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-primary/10" />
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>

            <aside className="rounded-2xl border border-primary/15 bg-secondary p-5 sm:p-6 lg:sticky lg:top-28">
              <h3 className="text-lg font-semibold">Amount Breakup</h3>

              <div className="mt-5 space-y-2.5 border-t border-primary/12 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-primary/75">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary/75">Discount</span>
                  <span className="text-green-700">- {formatPrice(discount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-primary/75">Delivery</span>
                  <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-primary/12 pt-4">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-semibold">{formatPrice(total)}</span>
              </div>

              <button
                type="button"
                aria-label="Proceed to buy"
                disabled={lines.length === 0}
                className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Proceed to Buy
              </button>
            </aside>
          </div>
        </section>
      </main>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Use Email OTP to sync and protect your cart across devices."
      />
    </>
  );
}
