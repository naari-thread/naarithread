"use client";

import { AnimatePresence, motion } from "framer-motion";

import { EmailOtpAuthForm } from "@/app/components/email-otp-auth-form";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
};

export function AuthModal({
  open,
  onClose,
  title = "Continue with Email OTP",
  description = "Sign up or log in to save products, track orders, and manage your profile.",
}: AuthModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[150] flex items-end justify-center bg-primary/40 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          aria-label="Authentication modal backdrop"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[1.8rem] border border-primary/15 bg-secondary p-3 shadow-[0_26px_60px_rgba(42,15,15,0.25)] sm:p-4"
            role="dialog"
            aria-modal={true}
            aria-label="Sign up or login modal"
          >
            <div className="mb-3 flex items-center justify-between px-2 pt-1">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-primary/65">NaariThread</p>
              <button
                type="button"
                aria-label="Close authentication modal"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-paper text-primary transition hover:border-primary/40"
              >
                <span className="relative h-3.5 w-3.5">
                  <span className="absolute left-0 top-[6px] block h-[1.5px] w-3.5 rotate-45 rounded-full bg-current" />
                  <span className="absolute left-0 top-[6px] block h-[1.5px] w-3.5 -rotate-45 rounded-full bg-current" />
                </span>
              </button>
            </div>

            <EmailOtpAuthForm title={title} description={description} onSuccess={onClose} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
