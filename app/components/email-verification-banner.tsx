"use client";

import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/components/auth-provider";

/**
 * Slim site-wide banner nudging email/password users to verify their address.
 * Hidden for verified users, signed-out visitors, and after dismissal. Google
 * accounts are always verified, so they never see it.
 */
export function EmailVerificationBanner() {
  const { user, isAuthenticated, resendVerificationEmail, normalizeError } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [isSending, setIsSending] = useState(false);

  if (!isAuthenticated || !user || user.emailVerified || dismissed) {
    return null;
  }

  const handleResend = async (): Promise<void> => {
    setIsSending(true);
    try {
      await resendVerificationEmail();
      toast.success("Verification email sent", {
        description: `Check ${user.email} for the verification link.`,
      });
    } catch (error) {
      toast.error("Could not send email", { description: normalizeError(error) });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-300/60 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 max-sm:flex-col"
    >
      <p className="leading-relaxed">
        Please verify your email{user.email ? <span className="font-semibold"> ({user.email})</span> : null} to secure
        your account.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Resend verification email"
          onClick={() => void handleResend()}
          disabled={isSending}
          className="font-semibold underline underline-offset-2 transition hover:text-amber-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSending ? "Sending…" : "Resend email"}
        </button>
        <button
          type="button"
          aria-label="Dismiss verification reminder"
          onClick={() => setDismissed(true)}
          className="text-amber-700/70 transition hover:text-amber-950"
        >
          <span className="relative block h-3 w-3" aria-hidden="true">
            <span className="absolute left-0 top-1/2 block h-[1.5px] w-3 -translate-y-1/2 rotate-45 rounded-full bg-current" />
            <span className="absolute left-0 top-1/2 block h-[1.5px] w-3 -translate-y-1/2 -rotate-45 rounded-full bg-current" />
          </span>
        </button>
      </div>
    </div>
  );
}
