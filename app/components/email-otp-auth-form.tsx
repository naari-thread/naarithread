"use client";

import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";

type EmailOtpAuthFormProps = {
  title: string;
  description: string;
  onSuccess?: () => void;
};

type AuthAction = "send" | "resend" | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpAuthForm({ title, description, onSuccess }: EmailOtpAuthFormProps) {
  const { isConfigured, sendEmailOtp, signInWithGoogle, normalizeError } = useAuth();

  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [activeAction, setActiveAction] = useState<AuthAction>(null);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const canSendLink = useMemo(() => emailPattern.test(email.trim().toLowerCase()), [email]);
  const isSendingLink = activeAction === "send";
  const isResendingLink = activeAction === "resend";
  const isSubmitting = activeAction !== null;

  const primaryButtonClassName =
    "mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

  const requestEmailLink = async (action: "send" | "resend", emailOverride?: string): Promise<void> => {
    const normalizedEmail = (emailOverride ?? email).trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      setErrorText("Enter a valid email to continue.");
      return;
    }

    setErrorText("");
    setActiveAction(action);

    try {
      setEmail(normalizedEmail);
      const response = await sendEmailOtp(normalizedEmail);
      setSentEmail(response.email);

      toast.success(action === "send" ? "Sign-in link sent" : "Fresh link sent", {
        description: `Continue from the email sent to ${response.email}. Check spam if it is not in your inbox.`,
      });
    } catch (error) {
      const message = normalizeError(error);
      setErrorText(message);
      toast.error(action === "send" ? "Could not send sign-in link" : "Could not resend sign-in link", {
        description: message,
      });
    } finally {
      setActiveAction(null);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    await requestEmailLink("send", submittedEmail);
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setErrorText("");
    setIsSigningInWithGoogle(true);

    try {
      await signInWithGoogle();
      toast.success("Signed in with Google", {
        description: "Welcome to NaariThread.",
      });
      onSuccess?.();
    } catch (error) {
      const message = normalizeError(error);
      setErrorText(message);

      if (message.toLowerCase().includes("cancelled")) {
        toast.info("Sign-in cancelled", { description: message });
      } else {
        toast.error("Google sign-in failed", { description: message });
      }
    } finally {
      setIsSigningInWithGoogle(false);
    }
  };

  if (!isConfigured) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-paper p-5 text-primary sm:p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-primary/75">
          Firebase auth is not configured yet. Add the Firebase environment variables to enable email link sign-in.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary/20 bg-paper p-5 text-primary sm:p-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary/60">Authentication</p>
      <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-primary/80">{description}</p>

      <AnimatePresence mode="wait" initial={false}>
        <motion.form
          key="email-link-step"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          onSubmit={handleEmailSubmit}
          className="mt-5"
        >
          <label htmlFor="email-link-auth-email" className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">
            Email address
          </label>
          <input
            id="email-link-auth-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-label="Email address for email link login"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="mt-2 h-12 w-full rounded-xl border border-primary/20 bg-secondary px-4 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.13)]"
            required
          />

          <button
            type="submit"
            aria-label="Send secure email sign-in link"
            disabled={!canSendLink || isSubmitting}
            className={primaryButtonClassName}
          >
            {isSendingLink ? "Sending Link..." : "Send Secure Link"}
          </button>

          <button
            type="button"
            aria-label="Resend secure email sign-in link"
            onClick={() => void requestEmailLink("resend")}
            disabled={!canSendLink || isSubmitting}
            className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isResendingLink ? "Resending..." : "Resend Link"}
          </button>

          {sentEmail ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-900">Check your inbox or spam folder</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">
                Open the secure sign-in link sent to <span className="font-semibold">{sentEmail}</span>. You can close this tab after opening the email.
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-primary/20" />
            <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/55">or</span>
            <span className="h-px flex-1 bg-primary/20" />
          </div>

          <button
            type="button"
            aria-label="Continue with Google"
            onClick={() => void handleGoogleSignIn()}
            disabled={isSigningInWithGoogle || isSubmitting}
            className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningInWithGoogle ? "Signing in..." : "Continue with Google"}
          </button>
        </motion.form>
      </AnimatePresence>

      {errorText ? <p className="mt-4 text-sm font-medium text-red-700">{errorText}</p> : null}
    </section>
  );
}
