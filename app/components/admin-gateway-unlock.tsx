"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

export function AdminGatewayUnlock() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isAdmin, createAuthJwt, normalizeError } = useAuth();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [message, setMessage] = useState("");

  async function unlockAdminGateway() {
    setIsUnlocking(true);
    setMessage("");

    try {
      const jwt = await createAuthJwt();
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Could not unlock admin gateway.");
      }

      router.refresh();
    } catch (error) {
      setMessage(normalizeError(error));
    } finally {
      setIsUnlocking(false);
    }
  }

  const canUnlock = !isLoading && isAuthenticated && isAdmin;

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Admin</p>
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Admin Dashboard</h1>
      <p className="mt-4 text-base leading-relaxed text-primary/85">
        Sign in with an allowed admin account and unlock the admin gateway to continue.
      </p>
      <button
        type="button"
        aria-label="Unlock admin gateway"
        onClick={() => void unlockAdminGateway()}
        disabled={!canUnlock || isUnlocking}
        className="cta-thread mt-6 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isUnlocking ? "Unlocking..." : "Unlock Admin Gateway"}
      </button>
      {!canUnlock ? (
        <p className="mt-3 text-sm text-primary/75">You must be signed in as an admin email to unlock this page.</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-primary/78">{message}</p> : null}
    </section>
  );
}
