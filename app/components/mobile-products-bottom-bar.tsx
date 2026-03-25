"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type MobileNavItem = {
  id: "shop" | "cart" | "wishlist" | "account";
  label: string;
  href: string;
  icon: "ShoppingBag01Icon" | "ShoppingCart02Icon" | "FavouriteIcon" | "UserIcon";
};

const mobileNavItems: MobileNavItem[] = [
  { id: "shop", label: "Shop", href: "/products", icon: "ShoppingBag01Icon" },
  { id: "cart", label: "Cart", href: "/cart", icon: "ShoppingCart02Icon" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist", icon: "FavouriteIcon" },
  { id: "account", label: "Account", href: "/account", icon: "UserIcon" },
];

export function MobileProductsBottomBar() {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  const shouldShowBar =
    pathname === "/products" ||
    pathname === "/cart" ||
    pathname === "/wishlist" ||
    pathname === "/account";

  if (!shouldShowBar) {
    return null;
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 24 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-[88] px-3 pb-4 pt-2 md:hidden"
      aria-label="Mobile quick actions"
    >
      <nav
        aria-label="Bottom navigation"
        className="mx-auto grid w-full max-w-sm grid-cols-4 gap-1.5 items-center rounded-[1.45rem] border border-primary/15 bg-secondary/95 p-1.5 shadow-[0_16px_40px_rgba(54,19,19,0.18)] backdrop-blur-lg"
      >
        {mobileNavItems.map((item) => {
          const isActive = item.href === "/products"
            ? pathname === "/products"
            : pathname === item.href;

          return (
            <Link
              key={item.label}
              href={item.href}
              aria-label={`Open ${item.label}`}
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
                {item.label === "Cart" ? (
                  <span
                    aria-label="2 items in cart"
                    className={`absolute -right-2.5 -top-2 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full ${isActive ? "bg-secondary text-primary" : "bg-primary text-secondary"} px-1 text-[10px] transition-colors font-semibold shadow-[0_4px_12px_rgba(0,0,0,0.35)]`}
                  >
                    2
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
