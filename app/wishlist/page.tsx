"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState } from "react";

import { AuthModal } from "@/app/components/auth-modal";
import { useAuth } from "@/app/components/auth-provider";

export default function WishlistPage() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const [isAuthModalDismissed, setIsAuthModalDismissed] = useState(false);
  const showAuthModal = !isLoading && !isAuthenticated && !isAuthModalDismissed;

  return (
    <>
      <main className="min-h-screen bg-paper px-4 pb-32 pt-24 text-primary sm:px-6 md:px-8 md:pb-20 md:pt-30">
        <section className="mx-auto w-full max-w-6xl">
          <header className="border-b border-primary/15 pb-5 sm:pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Saved</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Wishlist</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/82 sm:text-base">
              Build your personal style board and return to favorites across devices.
            </p>
          </header>

          {isLoading ? (
            <div className="mt-7 rounded-2xl border border-primary/12 bg-secondary p-6 text-sm text-primary/80">
              Checking your account session...
            </div>
          ) : null}

          {!isLoading && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 grid gap-4 rounded-2xl border border-primary/15 bg-secondary p-5 sm:grid-cols-[1.35fr_1fr] sm:p-7"
            >
              <div className="rounded-2xl border border-primary/12 bg-paper p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/65">Private Sync</p>
                <p className="mt-3 text-lg font-semibold">Sign up or login to open your wishlist</p>
                <p className="mt-2 text-sm leading-relaxed text-primary/75">
                  Saved products remain private to your account and sync automatically when you return.
                </p>
              </div>

              <div className="flex flex-col justify-between gap-3 rounded-2xl border border-primary/12 bg-paper p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">Start Here</p>
                <button
                  type="button"
                  aria-label="Open login or signup modal"
                  onClick={() => setIsAuthModalDismissed(false)}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
                >
                  Continue
                </button>
                <Link
                  href="/products"
                  aria-label="Browse products before login"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45"
                >
                  Browse Products
                </Link>
              </div>
            </motion.div>
          ) : null}

          {!isLoading && isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 rounded-2xl border border-primary/15 bg-secondary p-5 sm:p-7"
            >
              <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
                <div className="rounded-2xl border border-primary/12 bg-paper p-5 sm:p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">Hello {user?.name || "there"}</p>
                  <p className="mt-2 text-base leading-relaxed text-primary/80">
                    Your wishlist is connected. Product sync from Appwrite can now be surfaced here with filters and sorting.
                  </p>
                </div>

                <div className="rounded-2xl border border-primary/12 bg-paper p-5 sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">Quick Actions</p>
                  <div className="mt-4 flex flex-col gap-2.5">
                    <Link
                      href="/products"
                      aria-label="Browse more products"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
                    >
                      Browse Products
                    </Link>
                    <Link
                      href="/cart"
                      aria-label="Open cart page"
                      className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45"
                    >
                      Open Cart
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </section>
      </main>

      <AuthModal
        open={showAuthModal && !isAuthenticated}
        onClose={() => setIsAuthModalDismissed(true)}
        title="Sign up / Login to Wishlist"
        description="Use Email OTP to securely access your saved products and personalized picks."
      />
    </>
  );
}
