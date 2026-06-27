"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  browserLocalPersistence,
  isSignInWithEmailLink,
  setPersistence,
  signInWithEmailLink,
} from "firebase/auth";

import { EMAIL_LINK_STORAGE_KEY } from "@/app/components/auth-provider";
import { getFirebaseAuth } from "@/lib/firebase/config";

type Phase = "loading" | "need-email" | "working" | "done" | "error";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-link landing page. Completes the Firebase sign-in on whatever device
 * opened the link, then — if the link carried a cross-device `session` — tells
 * the server to approve it so the originating device (laptop) can sign itself in.
 */
export default function AuthCompletePage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [emailInput, setEmailInput] = useState("");
  const [errorText, setErrorText] = useState("");
  const sessionIdRef = useRef<string>("");
  const startedRef = useRef(false);

  const completeSignIn = useCallback(async (email: string): Promise<void> => {
    setPhase("working");
    setErrorText("");

    try {
      const auth = getFirebaseAuth();
      await setPersistence(auth, browserLocalPersistence);
      const credential = await signInWithEmailLink(auth, email, window.location.href);
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);

      // If this link was started on another device, approve that session so it
      // can sign itself in. The custom token is minted server-side for the
      // laptop only — never sent here.
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        const idToken = await credential.user.getIdToken();
        const res = await fetch("/api/auth/approve-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, idToken }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Could not confirm sign-in on your other device.");
        }
      }

      setPhase("done");
    } catch (error) {
      const message = error instanceof Error ? error.message : "This sign-in link is invalid or has expired.";
      setErrorText(message);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    sessionIdRef.current = params.get("session") ?? "";

    const auth = getFirebaseAuth();
    if (!isSignInWithEmailLink(auth, window.location.href)) {
      setErrorText("This sign-in link is invalid or has already been used.");
      setPhase("error");
      return;
    }

    // Same device that requested the link will have the email stored locally.
    const storedEmail = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
    if (storedEmail && emailPattern.test(storedEmail)) {
      void completeSignIn(storedEmail);
    } else {
      // Cross-device (e.g. opened on phone): ask the owner to confirm their email.
      setPhase("need-email");
    }
  }, [completeSignIn]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4 py-12 text-primary">
      <div className="w-full max-w-md rounded-2xl border border-primary/15 bg-secondary p-7 text-center shadow-[0_20px_50px_rgba(42,15,15,0.16)] sm:p-9">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-primary/55">NaariThread</p>

        {phase === "loading" || phase === "working" ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <span className="relative size-12">
              <span className="absolute inset-0 rounded-full border-2 border-primary/15" />
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/70 motion-safe:animate-spin [animation-duration:900ms]" />
            </span>
            <p className="text-sm font-medium text-primary/75">
              {phase === "working" ? "Verifying your sign-in…" : "Opening your secure link…"}
            </p>
          </div>
        ) : null}

        {phase === "need-email" ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const email = emailInput.trim().toLowerCase();
              if (!emailPattern.test(email)) {
                setErrorText("Enter the email this link was sent to.");
                return;
              }
              void completeSignIn(email);
            }}
            className="mt-6 text-left"
          >
            <h1 className="text-center text-xl font-semibold">Confirm your email</h1>
            <p className="mt-2 text-center text-sm leading-relaxed text-primary/65">
              For your security, confirm the email this link was sent to. We&apos;ll then sign you in — including the
              device where you started.
            </p>
            <label htmlFor="confirm-email" className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-primary/60">
              Email address
            </label>
            <input
              id="confirm-email"
              type="email"
              autoComplete="email"
              aria-label="Confirm email address"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              placeholder="you@example.com"
              className="mt-2 h-12 w-full rounded-xl border border-primary/20 bg-paper px-4 text-sm outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.13)]"
              required
            />
            <button
              type="submit"
              aria-label="Confirm and sign in"
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
            >
              Confirm &amp; Sign In
            </button>
            {errorText ? <p className="mt-3 text-center text-sm font-medium text-red-700">{errorText}</p> : null}
          </form>
        ) : null}

        {phase === "done" ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-7" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </span>
            <h1 className="text-xl font-semibold">You&apos;re verified</h1>
            <p className="text-sm leading-relaxed text-primary/65">
              {sessionIdRef.current
                ? "Head back to the device where you started — it's being signed in now. You can close this tab."
                : "You're signed in. You can continue shopping."}
            </p>
            <Link
              href="/"
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
            >
              Continue to NaariThread
            </Link>
          </div>
        ) : null}

        {phase === "error" ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-7" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </span>
            <h1 className="text-xl font-semibold">Sign-in link problem</h1>
            <p className="text-sm leading-relaxed text-primary/65">{errorText}</p>
            <Link
              href="/"
              className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary/25 bg-secondary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45"
            >
              Back to Home
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
