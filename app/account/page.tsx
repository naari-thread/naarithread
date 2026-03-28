"use client";

import { useAuth } from "@/app/components/auth-provider";
import { AccountDetailsModal } from "@/app/components/account-details-modal";
import { WalletDetailsModal } from "@/app/components/wallet-details-modal";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import Link from "next/link";

export default function AccountPage() {
  const { isAuthenticated, isLoading, logout, isAdmin } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper md:hidden">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-sm text-primary/60">Loading...</span>
        </div>
      </main>
    );
  }


  if (!isAuthenticated) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-paper p-4 md:hidden">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-primary mb-2">Access Denied</h1>
          <p className="text-primary/70 mb-6">You need to be logged in to access this page.</p>
          <Link
            href="/products"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold uppercase tracking-widest text-secondary transition hover:bg-primary/90"
          >
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen md:hidden bg-paper py-6 px-4 overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl pb-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">Account</p>
            <h1 className="mt-1 text-2xl font-bold text-primary">My Account</h1>
          </div>
          {isAdmin && (
            <Link
              href="/admin"
              aria-label="Open admin panel"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-primary/20 bg-secondary px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/40 hover:bg-primary/5"
            >
              <DynamicHugeIcon name="ShoppingBag01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
              <span>Admin</span>
            </Link>
          )}
        </div>

        {/* Account Details Section */}
        <section className="mb-6 rounded-2xl border border-primary/16 bg-secondary p-4">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary/58 mb-4">Account Details</h2>
          <div className="space-y-3">
            <div className="overflow-y-auto overscroll-contain">
              <AccountDetailsModal
                onClose={() => {}}
                showLogout={false}
              />
            </div>
            <div className="flex gap-2.5 mt-4 pt-2 border-t border-primary/10">
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Logout from account"
                className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/40 hover:bg-primary/5"
              >
                Logout
              </button>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-primary/12 mb-6" />

        {/* Wallet Section */}
        <section className="rounded-2xl border border-primary/16 bg-secondary p-4">
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-primary/58 mb-4">Wallet</h2>
          <div className="overflow-y-auto overscroll-contain">
            <WalletDetailsModal />
          </div>
        </section>
      </div>
    </main>
  );
}
