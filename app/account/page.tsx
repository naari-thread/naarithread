"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/app/components/auth-provider";
import { AuthModal } from "@/app/components/auth-modal";
import { AccountDetailsModal } from "@/app/components/account-details-modal";
import { OrdersDetailsModal } from "@/app/components/orders-details-modal";
import { WalletDetailsModal } from "@/app/components/wallet-details-modal";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type Section = "profile" | "orders" | "wallet" | null;

type ActionItem = {
  id: Section;
  label: string;
  icon: "ShoppingBag01Icon" | "ShoppingCart01Icon" | "UserIcon";
};

const actions: ActionItem[] = [
  { id: "orders",  label: "Orders",       icon: "ShoppingBag01Icon" },
  { id: "wallet",  label: "Refund Wallet",icon: "ShoppingCart01Icon" },
  { id: "profile", label: "Edit Profile", icon: "UserIcon" },
];

export default function AccountPage() {
  const { isAuthenticated, isLoading, logout, isAdmin, user } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
    setIsLoggingOut(false);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper md:hidden">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-sm text-primary/60">Loading...</span>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-6 pb-32 md:hidden">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/8">
          <DynamicHugeIcon name="UserIcon" className="h-8 w-8 text-primary/60" iconStrokeWidth={1.8} />
        </div>
        <h1 className="font-display mb-2 text-center text-2xl font-semibold text-primary">Your Profile</h1>
        <p className="mb-8 text-center text-sm leading-relaxed text-primary/60">
          Sign in to view your orders, manage your account, and save your wishlist.
        </p>
        <button
          type="button"
          onClick={() => setIsAuthModalOpen(true)}
          className="cta-thread-hero w-full max-w-xs justify-center"
        >
          <span>Sign In / Create Account</span>
        </button>
        <p className="mt-3 text-center text-[0.7rem] text-primary/40">
          Free · No spam · Secure email link
        </p>
        <AuthModal
          open={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          title="Sign up / Login"
          description="Use a secure email link to continue with your account and sync."
        />
      </main>
    );
  }

  const email = user?.email ?? "";
  const displayName = user?.name ?? "";

  return (
    <main className="min-h-[100dvh] bg-paper pb-32 md:hidden">
      {/* Sticky header — label only, no action icons */}
      <div className="sticky top-0 z-10 border-b border-primary/10 bg-paper/95 px-4 py-3 backdrop-blur-md">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/55">Profile</p>
      </div>

      <div className="px-4 pt-5">
        {/* Avatar + identity */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <DynamicHugeIcon name="UserIcon" className="h-7 w-7" iconStrokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            {displayName ? (
              <p className="truncate text-base font-semibold text-primary">{displayName}</p>
            ) : null}
            <p className="truncate text-sm text-primary/60">{email}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mb-5 flex flex-col gap-2">
          {actions.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              aria-expanded={activeSection === id}
              onClick={() => setActiveSection(activeSection === id ? null : id)}
              className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-semibold transition ${
                activeSection === id
                  ? "border-primary/20 bg-primary text-secondary"
                  : "border-primary/12 bg-secondary text-primary hover:border-primary/22 hover:bg-primary/[0.03]"
              }`}
            >
              <span className="flex items-center gap-3">
                <DynamicHugeIcon name={icon} className="h-4.5 w-4.5" iconStrokeWidth={2} />
                {label}
              </span>
              <DynamicHugeIcon
                name="ArrowDown01Icon"
                className={`h-4 w-4 transition-transform duration-200 ${activeSection === id ? "rotate-180" : "rotate-0"}`}
                iconStrokeWidth={2}
              />
            </button>
          ))}

          {isAdmin ? (
            <Link
              href="/admin"
              aria-label="Open admin panel"
              className="flex w-full items-center justify-between rounded-2xl border border-primary/12 bg-secondary px-4 py-3.5 text-sm font-semibold text-primary transition hover:border-primary/22 hover:bg-primary/[0.03]"
            >
              <span className="flex items-center gap-3">
                <DynamicHugeIcon name="ShoppingBag01Icon" className="h-4.5 w-4.5" iconStrokeWidth={2} />
                Admin Panel
              </span>
              <DynamicHugeIcon name="ArrowDown01Icon" className="h-4 w-4 -rotate-90" iconStrokeWidth={2} />
            </Link>
          ) : null}
        </div>

        {/* Expanded sections */}
        <AnimatePresence initial={false}>
          {activeSection === "orders" ? (
            <motion.div
              key="orders"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-3 rounded-2xl border border-primary/12 bg-secondary p-4">
                <OrdersDetailsModal onClose={() => setActiveSection(null)} />
              </div>
            </motion.div>
          ) : null}

          {activeSection === "wallet" ? (
            <motion.div
              key="wallet"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-3 rounded-2xl border border-primary/12 bg-secondary p-4">
                <WalletDetailsModal onClose={() => setActiveSection(null)} />
              </div>
            </motion.div>
          ) : null}

          {activeSection === "profile" ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mb-3 rounded-2xl border border-primary/12 bg-secondary p-4">
                <AccountDetailsModal onClose={() => setActiveSection(null)} showLogout={false} />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Logout — text button, clearly labelled */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="mt-2 w-full rounded-2xl border border-primary/12 bg-secondary py-3.5 text-sm font-semibold text-primary/70 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          {isLoggingOut ? "Logging out…" : "Logout"}
        </button>
      </div>
    </main>
  );
}
