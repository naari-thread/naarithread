"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { AuthModal } from "@/app/components/auth-modal";
import { useAuth } from "@/app/components/auth-provider";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { SizeColorPickerModal } from "@/app/components/size-color-picker-modal";
import type { ProductRecord } from "@/lib/appwrite/products";
import { readWishlistItems, readWishlistItemSelections, toggleWishlistItem, writeWishlistItemSelection, writeWishlistItems, type WishlistItemsMap, type WishlistItemSelectionsMap } from "@/lib/wishlist-state";
import { readCartItems, readCartItemSelections, writeCartItemSelection, writeCartItems } from "@/lib/cart-state";
import { showActionToast } from "@/lib/action-toast";
import { readUserWishlistMap, upsertUserWishlistMap, upsertUserCartMap } from "@/lib/appwrite/shop-sync";
import {
  areProductsEquivalent,
  fetchCatalogProductsFromApi,
  readCachedProductSnapshot,
  writeCachedProductSnapshot,
} from "@/lib/product-catalog-cache";

export function WishlistPageClient() {
  const { isLoading, isAuthenticated, user, createAuthJwt } = useAuth();
  const [wishlistItems, setWishlistItems] = useState<WishlistItemsMap>({});
  const [wishlistSelections, setWishlistSelections] = useState<WishlistItemSelectionsMap>({});
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [hasCompletedCatalogSync, setHasCompletedCatalogSync] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pickerProduct, setPickerProduct] = useState<ProductRecord | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setWishlistItems(readWishlistItems());
      setWishlistSelections(readWishlistItemSelections());
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
        const { items: cloudWishlist, selections: cloudSelections } = await readUserWishlistMap(jwt, user.$id);
        if (!alive || Object.keys(cloudWishlist).length === 0) {
          return;
        }

        const merged = { ...cloudWishlist, ...readWishlistItems() };
        writeWishlistItems(merged);
        setWishlistItems(merged);

        // Restore size/color saved in the cloud when the local copy was lost.
        const localSelections = readWishlistItemSelections();
        const mergedSelections = { ...cloudSelections, ...localSelections };
        for (const [productId, sel] of Object.entries(mergedSelections)) {
          writeWishlistItemSelection(productId, sel);
        }
        setWishlistSelections(readWishlistItemSelections());
      } catch {
        // Keep local wishlist available if cloud read fails.
      }
    };

    void hydrateFromCloud();

    return () => {
      alive = false;
    };
  }, [createAuthJwt, isAuthenticated, user?.$id]);

  const { wishlistProducts, missingProductIds } = useMemo(() => {
    const selected = new Set(Object.keys(wishlistItems));
    const presentProducts = products.filter((item) => selected.has(item.id));
    const presentIds = new Set(presentProducts.map((item) => item.id));

    return {
      wishlistProducts: presentProducts,
      missingProductIds: Object.keys(wishlistItems).filter((productId) => !presentIds.has(productId)),
    };
  }, [products, wishlistItems]);

  const selectedCount = Object.keys(wishlistItems).length;

  const removeItem = async (productId: string, showConfirmation = true): Promise<void> => {
    const wasAdded = toggleWishlistItem(productId);
    if (wasAdded) {
      // toggle added it, but remove action should only remove.
      toggleWishlistItem(productId);
    }

    writeWishlistItemSelection(productId, null);
    setWishlistSelections(readWishlistItemSelections());

    const next = readWishlistItems();
    setWishlistItems(next);
    const productName = products.find((product) => product.id === productId)?.name ?? "Item";
    if (showConfirmation) {
      showActionToast({
        id: `wishlist-removed-${productId}`,
        message: "Removed from wishlist",
        description: productName,
        tone: "info",
      });
    }

    if (!isAuthenticated || !user?.$id) {
      return;
    }

    try {
      const jwt = await createAuthJwt();
      await upsertUserWishlistMap(jwt, user.$id, next, readWishlistItemSelections());
    } catch {
      // Local wishlist remains source of truth on temporary failures.
    }
  };

  const handleMoveToCartClick = (product: ProductRecord) => {
    const stored = wishlistSelections[product.id];
    const needsPicker = product.sizeOptions.length > 0 && !stored?.size;
    if (needsPicker || (product.colorOptions.length > 0 && !stored)) {
      setPickerProduct(product);
    } else {
      void doMoveToCart(product, stored?.size ?? "", stored?.color ?? (product.colorOptions[0] ?? ""));
    }
  };

  const doMoveToCart = async (product: ProductRecord, size: string, color: string) => {
    writeCartItemSelection(product.id, { size, color });
    writeWishlistItemSelection(product.id, null);
    setWishlistSelections(readWishlistItemSelections());

    const currentCart = readCartItems();
    const quantity = currentCart[product.id] || 0;
    const nextCart = { ...currentCart, [product.id]: quantity + 1 };

    writeCartItems(nextCart);
    void removeItem(product.id, false);
    showActionToast({
      id: `wishlist-moved-${product.id}`,
      message: "Moved to cart",
      description: product.name,
    });

    if (isAuthenticated && user?.$id) {
      try {
        const jwt = await createAuthJwt();
        await upsertUserCartMap(jwt, user.$id, nextCart, readCartItemSelections());
      } catch {
        // sync next time
      }
    }
  };

  return (
    <>
      {pickerProduct !== null && (
        <SizeColorPickerModal
          product={pickerProduct}
          actionLabel="Move to Cart"
          onConfirm={({ size, color }) => {
            const p = pickerProduct;
            setPickerProduct(null);
            void doMoveToCart(p, size, color);
          }}
          onClose={() => setPickerProduct(null)}
        />
      )}
      <main className="min-h-screen bg-paper px-4 pb-32 pt-7 text-primary sm:px-6 md:px-8 md:pb-20 md:pt-30">
        <section className="mx-auto w-full max-w-6xl">
          <header className="pb-6 border-b border-primary/15">
            <h1 className="text-3xl font-semibold sm:text-4xl">Wishlist</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary/65">
              Build your personal style board and return to favorites across devices.
            </p>
          </header>

          {!isLoading && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="hidden sm:flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-y border-primary/15 py-5 text-sm text-primary/80"
            >
              <span>Your wishlist is stored locally on this device. Sign in to sync it safely to your account. If you log out before sync, local items may be lost.</span>
              <button
                type="button"
                aria-label="Sign in to sync wishlist"
                onClick={() => setIsAuthModalOpen(true)}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90"
              >
                Sign in
              </button>
            </motion.div>
          ) : null}

          {selectedCount === 0 ? (
            <div className="mt-8 py-12 text-center text-sm text-primary/75">
              No items in wishlist yet. Explore products and tap the heart icon to save styles.
              <div className="mt-6">
                <Link
                  href="/products"
                  aria-label="Browse products"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-6 text-xs font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90"
                >
                  Browse products
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col">
              {wishlistProducts.map((product) => {
                const sellingPrice = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;

                return (
                  <article key={product.id} className="flex flex-col gap-6 border-b border-primary/10 py-6 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 items-start sm:items-center gap-5">
                      <Link
                        href={`/products/${product.category}/${product.subCategory}/${product.slug}`}
                        className="relative h-28 w-24 sm:h-32 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-primary/5 transition hover:opacity-90"
                      >
                        {product.mainImageUrl ? (
                          <CloudinaryImage
                            src={product.mainImageUrl}
                            alt={product.name}
                            fill
                            sizes="(max-width: 768px) 112px, 112px"
                            className="object-cover object-top"
                          />
                        ) : null}
                      </Link>

                      <div className="flex flex-col">
                        <Link href={`/products/${product.category}/${product.subCategory}/${product.slug}`} className="hover:underline">
                          <h2 className="text-base font-semibold sm:text-lg">{product.name}</h2>
                        </Link>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/65">
                          {product.categoryValue} • {product.subCategoryValue}
                        </p>

                        {(() => {
                          const sel = wishlistSelections[product.id];
                          if (!sel?.size && !sel?.color) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {sel.color && (
                                <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary/70">
                                  {sel.color}
                                </span>
                              )}
                              {sel.size && (
                                <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-0.5 text-[0.65rem] font-medium text-primary/70">
                                  Size: {sel.size}
                                </span>
                              )}
                            </div>
                          );
                        })()}

                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-base font-semibold">₹{sellingPrice.toLocaleString("en-IN")}</span>
                          {product.originalPrice > sellingPrice && (
                            <span className="text-xs text-primary/55 line-through">₹{product.originalPrice.toLocaleString("en-IN")}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2.5 sm:w-44 shrink-0">
                      <button
                        type="button"
                        aria-label={`Move ${product.name} to cart`}
                        onClick={() => handleMoveToCartClick(product)}
                        className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90"
                      >
                        Move to Cart
                      </button>
                      {/* <Link
                        href={`/products/${product.category}/${product.subCategory}/${product.slug}`}
                        aria-label={`Open ${product.name}`}
                        className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary/20 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        View Product
                      </Link> */}
                      <button
                        type="button"
                        aria-label={`Remove ${product.name} from wishlist`}
                        onClick={() => void removeItem(product.id)}
                        className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary/20 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}

              {missingProductIds.map((productId) =>
                hasCompletedCatalogSync ? (
                  <article key={productId} className="flex flex-col gap-4 border-b border-primary/10 py-6">
                    <div className="rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
                      <p className="text-sm font-medium text-primary">Product unavailable</p>
                      <p className="mt-1 text-xs text-primary/70">
                        This saved item could not be loaded right now. You can remove it from wishlist.
                      </p>
                      <button
                        type="button"
                        aria-label="Remove unavailable item from wishlist"
                        onClick={() => void removeItem(productId)}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-primary/20 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ) : (
                  <article key={productId} className="flex flex-col gap-6 border-b border-primary/10 py-6" aria-hidden={true}>
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
          )}
        </section>
      </main>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Sign in or create an account to sync your wishlist across devices."
      />
    </>
  );
}
