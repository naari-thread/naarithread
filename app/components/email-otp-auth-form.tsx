"use client";

import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";

type EmailOtpAuthFormProps = {
  title: string;
  description: string;
  onSuccess?: () => void;
};

type AuthAction = "send" | "resend" | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpAuthForm({ title, description, onSuccess }: EmailOtpAuthFormProps) {
  const { isConfigured, isAuthenticated, sendEmailOtp, signInWithGoogle, normalizeError } = useAuth();

  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [errorText, setErrorText] = useState("");
  const [activeAction, setActiveAction] = useState<AuthAction>(null);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  // Cross-device: once the user confirms the link on any device, the polling in
  // the auth provider signs this device in — close the modal when that happens.
  useEffect(() => {
    if (sentEmail && isAuthenticated) {
      toast.success("Signed in", { description: "Welcome to NaariThread." });
      onSuccess?.();
    }
  }, [isAuthenticated, sentEmail, onSuccess]);

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

      {/* Google sign-in — preferred, shown first */}
      <div className="relative mt-5">
        <span className="absolute -top-2.5 right-3 inline-flex items-center rounded-full border border-primary/18 bg-secondary px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary/60">
          Preferred
        </span>
        <button
          type="button"
          aria-label="Continue with Google"
          onClick={() => void handleGoogleSignIn()}
          disabled={isSigningInWithGoogle || isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-primary/25 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45 hover:bg-primary/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isSigningInWithGoogle ? "Signing in…" : "Continue with Google"}
        </button>
      </div>

      {/* Divider */}
      <div className="mt-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-primary/15" />
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/45">or sign in with email</span>
        <span className="h-px flex-1 bg-primary/15" />
      </div>

      {/* Email form */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (sentEmail) {
            await requestEmailLink("resend");
          } else {
            const formData = new FormData(e.currentTarget);
            await requestEmailLink("send", String(formData.get("email") ?? ""));
          }
        }}
        className="mt-4"
      >
        <label htmlFor="email-link-auth-email" className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">
          Email address
        </label>
        <input
          id="email-link-auth-email"
          name="email"
          type="email"
          autoComplete="email"
          aria-label="Email address for sign-in"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="mt-2 h-12 w-full rounded-xl border border-primary/20 bg-secondary px-4 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.13)]"
          required
        />

        <button
          type="submit"
          aria-label={sentEmail ? "Resend secure email sign-in link" : "Send secure email sign-in link"}
          disabled={!canSendLink || isSubmitting}
          className={primaryButtonClassName}
        >
          {isSendingLink ? "Sending…" : isResendingLink ? "Resending…" : sentEmail ? "Resend Link" : "Send Secure Link"}
        </button>

        {sentEmail ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-emerald-300 border-t-emerald-600" aria-hidden="true" />
              <p className="text-xs font-semibold text-emerald-900">
                Waiting for confirmation — link sent to <span className="font-bold">{sentEmail}</span>
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-emerald-800/80">
              Open the link on <span className="font-semibold">any device — even your phone</span>. Keep this tab open;
              it will sign you in automatically once you confirm. Check your <span className="font-semibold">Spam folder</span> if it&apos;s not in your inbox.
            </p>
          </div>
        ) : null}
      </form>

      {errorText ? <p className="mt-4 text-sm font-medium text-red-700">{errorText}</p> : null}
    </section>
  );
}
