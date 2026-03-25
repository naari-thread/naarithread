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
      <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 pb-32 text-primary md:pb-16">
        <section className="w-full max-w-3xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Saved</p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Wishlist</h1>
          <p className="mt-4 text-base leading-relaxed text-primary/85">
            Build your personal style board and return to favorites anytime across devices.
          </p>

          {isLoading ? (
            <div className="mt-8 rounded-2xl border border-primary/12 bg-paper p-6 text-sm text-primary/80">
              Checking your account session...
            </div>
          ) : null}

          {!isLoading && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 rounded-2xl border border-primary/15 bg-paper p-6 text-center sm:p-8"
            >
              <p className="text-lg font-semibold">Sign up or login to see your wishlist</p>
              <p className="mt-2 text-sm leading-relaxed text-primary/75">
                Your saved products are private to your account for security and cross-device sync.
              </p>

              <button
                type="button"
                aria-label="Open login or signup modal"
                onClick={() => setIsAuthModalDismissed(false)}
                className="cta-thread mt-5"
              >
                Continue
              </button>
            </motion.div>
          ) : null}

          {!isLoading && isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 rounded-2xl border border-primary/15 bg-paper p-6 sm:p-8"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/70">Hello {user?.name || "there"}</p>
              <p className="mt-2 text-base text-primary/80">
                Your wishlist is connected. Product sync with Appwrite can now be added from the admin dashboard.
              </p>
            </motion.div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/products" aria-label="Browse more products" className="cta-thread">
              Browse Products
            </Link>
            <Link
              href="/cart"
              aria-label="Open cart page"
              className="thread-underline text-sm font-semibold uppercase tracking-[0.2em]"
            >
              Cart
            </Link>
          </div>
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
