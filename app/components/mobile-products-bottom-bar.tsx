"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { getCartItemsCount, readCartItems, subscribeToCartChanges } from "@/lib/cart-state";
import { getWishlistItemsCount, readWishlistItems, subscribeToWishlistChanges } from "@/lib/wishlist-state";

type MobileNavItem = {
  id: "shop" | "cart" | "wishlist" | "account";
  label: string;
  href: string;
  icon: "ShoppingBag01Icon" | "ShoppingCart02Icon" | "FavouriteIcon" | "UserIcon";
};

const mobileNavItems: MobileNavItem[] = [
  { id: "shop",     label: "Shop",    href: "/products", icon: "ShoppingBag01Icon" },
  { id: "wishlist", label: "Wishlist",href: "/wishlist", icon: "FavouriteIcon" },
  { id: "cart",     label: "Cart",    href: "/cart",     icon: "ShoppingCart02Icon" },
  { id: "account",  label: "Profile", href: "/account",  icon: "UserIcon" },
];

export function MobileProductsBottomBar() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCartCount(getCartItemsCount(readCartItems()));
      setWishlistCount(getWishlistItemsCount(readWishlistItems()));
    });
    return () => { window.cancelAnimationFrame(frame); };
  }, []);

  useEffect(() => subscribeToCartChanges((items) => setCartCount(getCartItemsCount(items))), []);
  useEffect(() => subscribeToWishlistChanges((items) => setWishlistCount(getWishlistItemsCount(items))), []);

  const shouldShowBar =
    pathname === "/" ||
    pathname === "/products" ||
    pathname.startsWith("/products/") ||
    pathname === "/cart" ||
    pathname === "/wishlist" ||
    pathname === "/account";

  if (!shouldShowBar) return null;

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-[88] border-t border-primary/14 bg-secondary/95 px-1.5 pb-2.5 pt-2 shadow-[0_-10px_30px_rgba(54,19,19,0.12)] backdrop-blur-md md:hidden"
      aria-label="Mobile quick actions"
    >
      <nav
        aria-label="Bottom navigation"
        className="pointer-events-auto relative z-10 grid w-full grid-cols-4 gap-1 items-center"
      >
        {mobileNavItems.map((item) => {
          const isActive =
            item.id === "shop"
              ? pathname === "/products" || pathname.startsWith("/products/")
              : pathname === item.href;

          const badgeCount =
            item.id === "cart" ? cartCount : item.id === "wishlist" ? wishlistCount : 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              aria-label={`Open ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1.05rem] px-1 py-2.5 text-[0.72rem] font-semibold tracking-[0.01em] transition-all duration-250 ${
                isActive
                  ? "text-secondary"
                  : "text-primary/70 hover:bg-primary/5 hover:text-primary"
              }`}
            >
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
            </Link>
          );
        })}
      </nav>
    </motion.div>
  );
}
