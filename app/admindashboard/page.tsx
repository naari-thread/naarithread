"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/components/auth-provider";

type AdminOverview = {
  products: number;
  orders: number;
  payments: number;
  reviews: number;
};

const initialProductPayload = {
  name: "",
  description: "",
  sku: "",
  category: "",
  mainImageUrl: "",
  discountPrice: "",
  originalPrice: "",
  stockQty: "",
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated, isAdmin, createAuthJwt, normalizeError } = useAuth();

  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [productPayload, setProductPayload] = useState(initialProductPayload);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);

  const canOpenDashboard = useMemo(() => !isLoading && isAuthenticated && isAdmin, [isAdmin, isAuthenticated, isLoading]);

  async function unlockAdminGateway() {
    setIsUnlocking(true);
    setStatusMessage("");

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

      setIsSessionReady(true);
      setStatusMessage("Admin gateway unlocked.");
      router.refresh();
    } catch (error) {
      setStatusMessage(normalizeError(error));
    } finally {
      setIsUnlocking(false);
    }
  }

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { method: "GET" });

      if (!response.ok) {
        if (response.status === 401) {
          setIsSessionReady(false);
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to fetch overview");
      }

      const data = (await response.json()) as AdminOverview;
      setOverview(data);
      setIsSessionReady(true);
    } catch (error) {
      setStatusMessage(normalizeError(error));
    }
  }, [normalizeError]);

  useEffect(() => {
    if (!canOpenDashboard) {
      return;
    }

    void loadOverview();
  }, [canOpenDashboard, loadOverview]);

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmittingProduct(true);
    setStatusMessage("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...productPayload,
          discountPrice: Number(productPayload.discountPrice),
          originalPrice: Number(productPayload.originalPrice),
          stockQty: Number(productPayload.stockQty || 0),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create product");
      }

      setProductPayload(initialProductPayload);
      setStatusMessage("Product created successfully.");
      await loadOverview();
    } catch (error) {
      setStatusMessage(normalizeError(error));
    } finally {
      setIsSubmittingProduct(false);
    }
  }

  if (!canOpenDashboard) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 pb-32 text-primary md:pb-16 md:pt-28">
        <section className="w-full max-w-2xl rounded-3xl border border-primary/20 bg-secondary p-8 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Admin</p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Admin Dashboard</h1>
          <p className="mt-4 text-base leading-relaxed text-primary/85">
            Sign in with the configured admin email from your account page to access this route.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-28 pt-24 text-primary sm:px-6 md:px-10 md:pb-12 md:pt-30">
      <section className="mx-auto w-full max-w-6xl">
        <div className="rounded-3xl border border-primary/20 bg-secondary p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Admin</p>
          <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">Dashboard</h1>
          <p className="mt-3 text-sm text-primary/80">
            Gateway 2: admin actions call Vercel serverless API routes. Gateway 3: routes verify admin email and use Appwrite Server SDK.
          </p>

          {!isSessionReady ? (
            <button
              type="button"
              aria-label="Unlock admin gateway"
              onClick={() => void unlockAdminGateway()}
              disabled={isUnlocking}
              className="cta-thread mt-5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUnlocking ? "Unlocking..." : "Unlock Admin Gateway"}
            </button>
          ) : null}

          {statusMessage ? <p className="mt-4 text-sm text-primary/85">{statusMessage}</p> : null}
        </div>

        {isSessionReady ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              { label: "Products", value: overview?.products ?? 0 },
              { label: "Orders", value: overview?.orders ?? 0 },
              { label: "Payments", value: overview?.payments ?? 0 },
              { label: "Reviews", value: overview?.reviews ?? 0 },
            ].map((item) => (
              <motion.article
                key={item.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24 }}
                className="rounded-2xl border border-primary/15 bg-secondary/80 p-5"
              >
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary/65">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </motion.article>
            ))}
          </div>
        ) : null}

        {isSessionReady ? (
          <section className="mt-6 rounded-3xl border border-primary/15 bg-secondary p-6 sm:p-8">
            <h2 className="text-xl font-semibold sm:text-2xl">Create Product</h2>
            <p className="mt-2 text-sm text-primary/75">This submits through Gateway 2 serverless route: /api/admin/products.</p>

            <form onSubmit={handleCreateProduct} className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { key: "name", label: "Name" },
                { key: "sku", label: "SKU" },
                { key: "category", label: "Category" },
                { key: "mainImageUrl", label: "Main Image URL" },
                { key: "discountPrice", label: "Discount Price" },
                { key: "originalPrice", label: "Original Price" },
                { key: "stockQty", label: "Stock Qty" },
              ].map((field) => (
                <label key={field.key} className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">{field.label}</span>
                  <input
                    aria-label={field.label}
                    value={productPayload[field.key as keyof typeof initialProductPayload]}
                    onChange={(event) =>
                      setProductPayload((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                    className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm text-primary outline-none transition focus:border-primary"
                    required={field.key !== "stockQty"}
                  />
                </label>
              ))}

              <label className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">Description</span>
                <textarea
                  aria-label="Product description"
                  value={productPayload.description}
                  onChange={(event) =>
                    setProductPayload((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  className="rounded-xl border border-primary/18 bg-paper px-3 py-2.5 text-sm text-primary outline-none transition focus:border-primary"
                  required
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  aria-label="Create product"
                  disabled={isSubmittingProduct}
                  className="cta-thread disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingProduct ? "Creating..." : "Create Product"}
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </section>
    </main>
  );
}
