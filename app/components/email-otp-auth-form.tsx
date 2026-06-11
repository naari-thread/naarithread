"use client";

import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { useMemo, useState } from "react";

import { AnimatedOtpInput } from "@/app/components/animated-otp-input";
import { useAuth } from "@/app/components/auth-provider";

type EmailOtpAuthFormProps = {
  title: string;
  description: string;
  onSuccess?: () => void;
};

type StepState = "email" | "otp";
type OtpAction = "send" | "resend" | "verify" | null;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailOtpAuthForm({ title, description, onSuccess }: EmailOtpAuthFormProps) {
  const { isConfigured, sendEmailOtp, verifyEmailOtp, signInWithGoogle, normalizeError } = useAuth();

  const [step, setStep] = useState<StepState>("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const [errorText, setErrorText] = useState("");
  const [activeAction, setActiveAction] = useState<OtpAction>(null);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);

  const canSendOtp = useMemo(() => emailPattern.test(email.trim().toLowerCase()), [email]);
  const canVerify = otp.length === 6 && /^\d{6}$/.test(otp);
  const isSendingOtp = activeAction === "send";
  const isResendingOtp = activeAction === "resend";
  const isVerifyingOtp = activeAction === "verify";
  const isSubmitting = activeAction !== null;

  const otpButtonClassName =
    "mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

  const requestOtp = async (action: "send" | "resend", emailOverride?: string) => {
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
      setUserId(response.userId);
      setEmail(response.email);
      setStep("otp");
      setOtp("");

      if (action === "send") {
        toast.success("OTP sent", {
          description: `Check inbox for ${response.email}.`,
        });
      } else {
        toast.success("OTP resent", {
          description: `A fresh code was sent to ${response.email}.`,
        });
      }
    } catch (error) {
      const message = normalizeError(error);
      if (message.toLowerCase().includes("failed to fetch")) {
        const networkMessage = "Could not reach authentication service from this device. Please check network and try again.";
        setErrorText(networkMessage);
        toast.error("Network error", { description: networkMessage });
      } else if (message.toLowerCase().includes("not configured")) {
        const configMessage = "Authentication is temporarily unavailable on this device. Refresh and try again.";
        setErrorText(configMessage);
        toast.error("Auth unavailable", { description: configMessage });
      } else {
        setErrorText(message);
        toast.error(action === "send" ? "Could not send OTP" : "Could not resend OTP", { description: message });
      }
    } finally {
      setActiveAction(null);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get("email") ?? "");
    await requestOtp("send", submittedEmail);
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canVerify) {
      setErrorText("Enter the 6-digit OTP sent to your email.");
      return;
    }

    setErrorText("");
    setActiveAction("verify");

    try {
      await verifyEmailOtp(userId, otp);
      setOtp("");
      toast.success("Logged in successfully", {
        description: "Welcome to NaariThread.",
      });
      onSuccess?.();
    } catch (error) {
      const message = normalizeError(error);
      setErrorText(message);
      toast.error("OTP verification failed", { description: message });
    } finally {
      setActiveAction(null);
    }
  };

  const handleResendOtp = async () => {
    await requestOtp("resend");
  };

  const handleGoogleSignIn = async () => {
    setErrorText("");
    setIsSigningInWithGoogle(true);

    try {
      await signInWithGoogle();
      toast.success("Signed in with Google", {
        description: "Redirecting to your account...",
      });
      onSuccess?.();
    } catch (error) {
      const message = normalizeError(error);
      setErrorText(message);
      
      if (message.toLowerCase().includes("network") || message.toLowerCase().includes("fetch")) {
        toast.error("Network error", {
          description: message,
        });
      } else if (message.toLowerCase().includes("cancelled")) {
        toast.info("Sign-in cancelled", {
          description: message,
        });
      } else if (message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("401") || message.toLowerCase().includes("test user")) {
        toast.error("Google auth setup incomplete", {
          description: message,
        });
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
          Appwrite auth is not configured yet. Add your Appwrite environment variables to enable Email OTP sign-in.
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
        {step === "email" ? (
          <motion.form
            key="email-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleEmailSubmit}
            className="mt-5"
          >
            <label htmlFor="email-otp-auth-email" className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/65">
              Email address
            </label>
            <input
              id="email-otp-auth-email"
              name="email"
              type="email"
              autoComplete="email"
              aria-label="Email address for OTP login"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-xl border border-primary/20 bg-secondary px-4 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.13)]"
              required
            />

            <button
              type="submit"
              aria-label="Send email OTP"
              disabled={!canSendOtp || isSubmitting}
              className={otpButtonClassName}
            >
              {isSendingOtp ? "Sending OTP..." : "Send OTP"}
            </button>

            <button
              type="button"
              aria-label="Resend OTP email"
              onClick={() => void handleResendOtp()}
              disabled={!canSendOtp || isSubmitting}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResendingOtp ? "Resending..." : "Resend Email"}
            </button>

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
        ) : (
          <motion.form
            key="otp-step"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleOtpSubmit}
            className="mt-5"
          >
            <p className="text-sm text-primary/80">
              Enter the OTP sent to <span className="font-semibold">{email}</span>.
            </p>

            <div className="mt-4">
              <AnimatedOtpInput value={otp} onChange={setOtp} disabled={isSubmitting} autoFocus={true} />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                aria-label="Use a different email"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setErrorText("");
                }}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40"
              >
                Change Email
              </button>
              <button
                type="button"
                aria-label="Resend OTP email"
                onClick={() => void handleResendOtp()}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isResendingOtp ? "Resending..." : "Resend Email"}
              </button>
              <button
                type="submit"
                aria-label="Verify OTP and sign in"
                disabled={!canVerify || isSubmitting}
                className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isVerifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {errorText ? <p className="mt-4 text-sm font-medium text-red-700">{errorText}</p> : null}
    </section>
  );
}
