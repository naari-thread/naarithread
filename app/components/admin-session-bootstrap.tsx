"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/components/auth-provider";

export function AdminSessionBootstrap() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isAdmin, createAuthJwt, normalizeError } = useAuth();
  const [message, setMessage] = useState("Checking admin access...");

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !isAdmin) {
      setMessage("Sign in with your admin account first, then revisit this page.");
      return;
    }

    let isCancelled = false;

    async function createSession() {
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
          throw new Error(payload.error ?? "Could not open admin session.");
        }

        if (!isCancelled) {
          router.refresh();
        }
      } catch (error) {
        if (!isCancelled) {
          setMessage(normalizeError(error));
        }
      }
    }

    void createSession();

    return () => {
      isCancelled = true;
    };
  }, [createAuthJwt, isAdmin, isAuthenticated, isLoading, normalizeError, router]);

  return (
    <section className="mx-auto w-full max-w-2xl rounded-3xl border border-primary/20 bg-secondary p-7 shadow-sm sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Admin</p>
      <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Access Required</h1>
      <p className="mt-3 text-base leading-relaxed text-primary/85">{message}</p>
    </section>
  );
}
