"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type AdminTab = "products" | "addons" | "orders" | "payments" | "refund-wallet";

type MobileBarProps = {
  activeTab: AdminTab;
};

type NavItem = {
  id: AdminTab;
  label: string;
  icon: "ShoppingBag01Icon" | "Notification01Icon" | "ShoppingCart02Icon" | "MailSend01Icon";
};

const navItems: NavItem[] = [
  { id: "products", label: "Products", icon: "ShoppingBag01Icon" },
  { id: "addons", label: "AddOns", icon: "Notification01Icon" },
  { id: "orders", label: "Orders", icon: "ShoppingCart02Icon" },
  { id: "payments", label: "Payments", icon: "MailSend01Icon" },
  { id: "refund-wallet", label: "Wallet", icon: "MailSend01Icon" },
];

export function AdminMobileBottomBar({ activeTab }: MobileBarProps) {
  const prefersReducedMotion = useReducedMotion();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("modal");
    params.delete("id");
    return params;
  }, [searchParams]);

  function navigateToTab(tab: AdminTab) {
    const params = new URLSearchParams(baseQuery.toString());
    params.set("tab", tab);

    if (tab !== "products") {
      params.delete("page");
    }

    if (tab !== "addons") {
      params.delete("addon");
      params.delete("addonsPage");
    }

    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-[92] border-t border-primary/14 bg-secondary/95 px-2 pb-3 pt-2 shadow-[0_-14px_34px_rgba(120,0,0,0.13)] backdrop-blur md:hidden"
      aria-label="Admin quick navigation"
    >
      <nav
        aria-label="Admin bottom navigation"
        className="grid grid-cols-5 touch-manipulation gap-1"
      >
        {navItems.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Open ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => navigateToTab(item.id)}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-[1rem] px-1 py-2 text-[0.62rem] font-semibold tracking-[0.01em] transition ${
                isActive ? "text-secondary" : "text-primary/75 hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId="admin-active-pill-mobile"
                  className="absolute inset-0 rounded-[1rem] bg-primary"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 440, damping: 34, mass: 0.75 }
                  }
                  aria-hidden={true}
                />
              ) : null}
              <DynamicHugeIcon name={item.icon} className="relative z-10 h-4.5 w-4.5" iconStrokeWidth={2} aria-hidden={true} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </motion.div>
  );
}
