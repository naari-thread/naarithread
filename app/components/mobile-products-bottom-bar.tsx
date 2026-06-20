"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { AccountDetailsModal } from "@/app/components/account-details-modal";
import { AuthModal } from "@/app/components/auth-modal";
import { OrdersDetailsModal } from "@/app/components/orders-details-modal";
import { WalletDetailsModal } from "@/app/components/wallet-details-modal";
import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { getCartItemsCount, readCartItems, subscribeToCartChanges } from "@/lib/cart-state";
import { getWishlistItemsCount, readWishlistItems, subscribeToWishlistChanges } from "@/lib/wishlist-state";

type MobileNavItem = {
  id: "shop" | "cart" | "wishlist" | "account";
  label: string;
  href?: string;
  icon: "ShoppingBag01Icon" | "ShoppingCart02Icon" | "FavouriteIcon" | "UserIcon";
};

const mobileNavItems: MobileNavItem[] = [
  { id: "shop", label: "Shop", href: "/products", icon: "ShoppingBag01Icon" },
  { id: "cart", label: "Cart", href: "/cart", icon: "ShoppingCart02Icon" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist", icon: "FavouriteIcon" },
  { id: "account", label: "Account", icon: "UserIcon" },
];

export function MobileProductsBottomBar() {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [selectedAccountAction, setSelectedAccountAction] = useState<"profile" | "wallet" | "orders" | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCartCount(getCartItemsCount(readCartItems()));
      setWishlistCount(getWishlistItemsCount(readWishlistItems()));
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => subscribeToCartChanges((items) => setCartCount(getCartItemsCount(items))), []);
  useEffect(() => subscribeToWishlistChanges((items) => setWishlistCount(getWishlistItemsCount(items))), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsAccountMenuOpen(false);
      setSelectedAccountAction(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated) {
      const frame = window.requestAnimationFrame(() => {
        setIsAccountMenuOpen(false);
        setSelectedAccountAction(null);
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    return undefined;
  }, [isAuthenticated]);

  const shouldShowBar =
    pathname === "/" ||
    pathname === "/products" ||
    pathname.startsWith("/products/") ||
    pathname === "/cart" ||
    pathname === "/wishlist";

  if (!shouldShowBar) {
    return null;
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-[88] border-t border-primary/14 bg-secondary/95 px-1.5 pb-2.5 pt-2 shadow-[0_-10px_30px_rgba(54,19,19,0.12)] backdrop-blur-md md:hidden"
      aria-label="Mobile quick actions"
    >
      <AnimatePresence>
        {isAccountMenuOpen ? (
          <motion.button
            type="button"
            aria-label="Close account menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-auto fixed inset-0 z-0 bg-transparent"
            onClick={() => setIsAccountMenuOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <nav
        aria-label="Bottom navigation"
        className="pointer-events-auto relative z-10 grid w-full grid-cols-4 gap-1 items-center"
      >
        {mobileNavItems.map((item) => {
          const baseIsActive = item.id === "shop"
            ? pathname === "/products" || pathname.startsWith("/products/")
            : item.href
              ? pathname === item.href
              : false;
          const isActive = item.id === "account" ? isAccountMenuOpen || selectedAccountAction !== null : baseIsActive;

          const badgeCount = item.id === "cart" ? cartCount : item.id === "wishlist" ? wishlistCount : 0;

          const content = (
            <>
              {isActive ? (
                <motion.span
                  layoutId="mobile-bottom-nav-active-pill"
                  className="absolute inset-0 rounded-[1.05rem] bg-primary shadow-[0_8px_18px_rgba(120,0,0,0.24)]"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 430, damping: 34, mass: 0.7 }
                  }
                  aria-hidden={true}
                />
              ) : null}

              <span className="relative z-10">
                <DynamicHugeIcon name={item.icon} className="h-5.5 w-5.5" iconStrokeWidth={2} aria-hidden={true} />
                {badgeCount > 0 ? (
                  <span
                    aria-label={`${badgeCount} items in ${item.label.toLowerCase()}`}
                    className={`absolute -right-2.5 -top-2 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full ${isActive ? "bg-secondary text-primary" : "bg-primary text-secondary"} px-1 text-[10px] font-semibold transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
                  >
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                ) : null}
              </span>
              <span className="relative z-10 mt-0.5 leading-none">{item.label}</span>
            </>
          );

          if (item.id === "account") {
            if (isAuthenticated) {
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-label="Open account"
                  aria-expanded={isAccountMenuOpen}
                  onClick={() => {
                    setIsAccountMenuOpen((previous) => !previous);
                  }}
                  className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 py-2.5 text-[0.72rem] font-semibold tracking-[0.01em] transition-all duration-250 ${
                    isActive
                      ? "text-secondary"
                      : "text-primary/70 hover:bg-primary/5 hover:text-primary"
                  }`}
                >
                  {content}
                </button>
              );
            }

            return (
              <button
                key={item.label}
                type="button"
                aria-label="Open account"
                onClick={() => {
                  if (!isAuthenticated && !isLoading) {
                    setIsAuthModalOpen(true);
                  }
                }}
                className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 py-2.5 text-[0.72rem] font-semibold tracking-[0.01em] transition-all duration-250 ${
                  isActive
                    ? "text-secondary"
                    : "text-primary/70 hover:bg-primary/5 hover:text-primary"
                }`}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href ?? "/"}
              aria-label={`Open ${item.label}`}
              onClick={() => setIsAccountMenuOpen(false)}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 py-2.5 text-[0.72rem] font-semibold tracking-[0.01em] transition-all duration-250 ${
                isActive
                  ? "text-secondary"
                  : "text-primary/70 hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {content}
            </Link>
          );
        })}

        <AnimatePresence>
          {isAuthenticated && isAccountMenuOpen ? (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-[calc(100%+10px)] right-0 z-[95] w-52 rounded-2xl border border-primary/14 bg-secondary p-2 shadow-[0_16px_36px_rgba(54,19,19,0.24)]"
            >
              <button
                type="button"
                aria-label="Open profile"
                onClick={() => {
                  setSelectedAccountAction("profile");
                  setIsAccountMenuOpen(false);
                }}
                className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
              >
                <span>Profile</span>
                <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Open refund wallet"
                onClick={() => {
                  setSelectedAccountAction("wallet");
                  setIsAccountMenuOpen(false);
                }}
                className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
              >
                  <span>Refund Wallet</span>
                <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Open orders"
                onClick={() => {
                  setSelectedAccountAction("orders");
                  setIsAccountMenuOpen(false);
                }}
                className="mb-1 inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
              >
                <span>Orders</span>
                <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
              </button>
              {isAdmin ? (
                <Link
                  href="/admin"
                  aria-label="Open admin panel"
                  onClick={() => setIsAccountMenuOpen(false)}
                  className="inline-flex h-10 w-full items-center justify-between rounded-xl px-3 text-sm text-primary/82 transition hover:bg-primary/[0.04]"
                >
                  <span>Admin</span>
                  <DynamicHugeIcon name="ArrowRight01Icon" className="h-4 w-4" iconStrokeWidth={2} />
                </Link>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </nav>

      <AnimatePresence initial={false}>
        {selectedAccountAction ? (
          <motion.div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/35 p-3 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedAccountAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-sm max-h-[78vh] rounded-2xl border border-primary/15 bg-secondary p-3 shadow-[0_20px_48px_rgba(120,0,0,0.2)]"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal={true}
              aria-label="Account details"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">
                  {selectedAccountAction === "profile" ? "Profile" : selectedAccountAction === "wallet" ? "Refund Wallet" : "Orders"}
                </p>
                <button
                  type="button"
                  aria-label="Close account modal"
                  onClick={() => setSelectedAccountAction(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/18 text-primary transition hover:border-primary/35"
                >
                  <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2.2} aria-hidden={true} />
                </button>
              </div>

              <div className="max-h-[calc(78vh-3.25rem)] overflow-y-auto overscroll-contain">
                {selectedAccountAction === "profile" ? (
                  <AccountDetailsModal onClose={() => setSelectedAccountAction(null)} showLogout={true} />
                ) : selectedAccountAction === "wallet" ? (
                  <WalletDetailsModal onClose={() => setSelectedAccountAction(null)} />
                ) : (
                  <OrdersDetailsModal onClose={() => setSelectedAccountAction(null)} />
                )}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Use a secure email link to continue with your account and sync."
      />
    </motion.div>
  );
}
