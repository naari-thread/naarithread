"use client";

import { toast } from "sonner";
import { useState } from "react";

import { useAuth } from "@/app/components/auth-provider";

type EmailPasswordAuthFormProps = {
  title: string;
  description: string;
  onSuccess?: () => void;
};

type Mode = "signin" | "signup" | "reset";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const fieldClassName =
  "mt-2 h-12 w-full rounded-xl border border-primary/20 bg-secondary px-4 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.13)]";
const labelClassName = "text-xs font-semibold uppercase tracking-[0.22em] text-primary/65";
const primaryButtonClassName =
  "mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Email + password authentication (sign in, sign up, forgot password) with
 * Google sign-in as the one-click option. Replaces the previous email-link
 * flow — passwords are self-contained proof and avoid the cross-device
 * link-forwarding risk, which matters for accounts that hold wallet balance.
 */
export function EmailPasswordAuthForm({ title, description, onSuccess }: EmailPasswordAuthFormProps) {
  const {
    isConfigured,
    signUpWithEmailPassword,
    signInWithEmailPassword,
    sendPasswordReset,
    signInWithGoogle,
    normalizeError,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorText, setErrorText] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const switchMode = (next: Mode): void => {
    setMode(next);
    setErrorText("");
    setResetSent(false);
    setPassword("");
  };

  const handleGoogleSignIn = async (): Promise<void> => {
    setErrorText("");
    setIsSigningInWithGoogle(true);
    try {
      await signInWithGoogle();
      toast.success("Signed in with Google", { description: "Welcome to NaariThread." });
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setErrorText("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      setErrorText("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "reset") {
        await sendPasswordReset(normalizedEmail);
        setResetSent(true);
        toast.success("Reset link sent", {
          description: `Check ${normalizedEmail} for a link to reset your password.`,
        });
        return;
      }

      if (mode === "signup") {
        await signUpWithEmailPassword(normalizedEmail, password, fullName);
        toast.success("Account created", {
          description: "We've sent a verification link to your email.",
        });
        onSuccess?.();
        return;
      }

      await signInWithEmailPassword(normalizedEmail, password);
      toast.success("Signed in", { description: "Welcome back to NaariThread." });
      onSuccess?.();
    } catch (error) {
      const message = normalizeError(error);
      setErrorText(message);
      toast.error(
        mode === "reset" ? "Could not send reset link" : mode === "signup" ? "Could not create account" : "Sign-in failed",
        { description: message },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isConfigured) {
    return (
      <section className="rounded-2xl border border-primary/20 bg-paper p-5 text-primary sm:p-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-primary/75">
          Firebase auth is not configured yet. Add the Firebase environment variables to enable sign-in.
        </p>
      </section>
    );
  }

  const heading = mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : title;
  const subheading =
    mode === "signup"
      ? "Sign up to save products, track orders, and use your wallet."
      : mode === "reset"
        ? "Enter your email and we'll send you a secure link to set a new password."
        : description;

  const submitLabel =
    mode === "reset"
      ? isSubmitting
        ? "Sending…"
        : "Send Reset Link"
      : mode === "signup"
        ? isSubmitting
          ? "Creating…"
          : "Create Account"
        : isSubmitting
          ? "Signing in…"
          : "Sign In";

  return (
    <section className="rounded-2xl border border-primary/20 bg-paper p-5 text-primary sm:p-6">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary/60">Authentication</p>
      <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">{heading}</h2>
      <p className="mt-3 text-sm leading-relaxed text-primary/80">{subheading}</p>

      {/* Google sign-in — preferred, shown first */}
      <div className="relative mt-5">
        <span className="absolute -top-2.5 right-3 inline-flex items-center rounded-full border border-primary/18 bg-secondary px-2 py-0.5 text-[0.56rem] font-semibold uppercase tracking-[0.14em] text-primary/60">
          1-click
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
        <span className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-primary/45">
          {mode === "reset" ? "reset via email" : "or use email"}
        </span>
        <span className="h-px flex-1 bg-primary/15" />
      </div>

      {resetSent ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold text-emerald-900">Reset link sent</p>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-800/80">
            Check <span className="font-semibold">{email.trim().toLowerCase()}</span> for a link to set a new password.
            Look in your <span className="font-semibold">Spam folder</span> if it&apos;s not in your inbox.
          </p>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="mt-4">
          {mode === "signup" ? (
            <div className="mb-4">
              <label htmlFor="auth-fullname" className={labelClassName}>
                Full name
              </label>
              <input
                id="auth-fullname"
                name="name"
                type="text"
                autoComplete="name"
                aria-label="Full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Your name"
                className={fieldClassName}
              />
            </div>
          ) : null}

          <label htmlFor="auth-email" className={labelClassName}>
            Email address
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            aria-label="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className={fieldClassName}
            required
          />

          {mode !== "reset" ? (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label htmlFor="auth-password" className={labelClassName}>
                  Password
                </label>
                {mode === "signin" ? (
                  <button
                    type="button"
                    aria-label="Forgot your password"
                    onClick={() => switchMode("reset")}
                    className="text-[0.7rem] font-semibold text-primary/70 underline-offset-2 transition hover:text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                aria-label="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                className={fieldClassName}
                minLength={6}
                required
              />
            </div>
          ) : null}

          <button type="submit" aria-label={submitLabel} disabled={isSubmitting} className={primaryButtonClassName}>
            {submitLabel}
          </button>
        </form>
      )}

      {errorText ? <p className="mt-4 text-sm font-medium text-red-700">{errorText}</p> : null}

      {/* Mode switch footer */}
      <div className="mt-5 border-t border-primary/12 pt-4 text-center text-sm text-primary/70">
        {mode === "signin" ? (
          <p>
            New to NaariThread?{" "}
            <button
              type="button"
              aria-label="Create a new account"
              onClick={() => switchMode("signup")}
              className="font-semibold text-primary underline-offset-2 transition hover:underline"
            >
              Create an account
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              aria-label="Back to sign in"
              onClick={() => switchMode("signin")}
              className="font-semibold text-primary underline-offset-2 transition hover:underline"
            >
              Sign in
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
