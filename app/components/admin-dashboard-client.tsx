"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { useAuth } from "@/app/components/auth-provider";

type AdminOverview = {
  products: number;
  orders: number;
  payments: number;
  reviews: number;
  pendingFulfillment: number;
  delivered: number;
};

type AdminOrderItem = {
  productName: string;
  quantity: number;
  lineAmount: number;
};

type AdminOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  userEmail: string;
  userId: string;
  placedAt: string;
  items: AdminOrderItem[];
};

const ORDER_STATUS_OPTIONS = [
  { value: "placed", label: "Ordered" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
] as const;

function statusToLabel(status: string) {
  const opt = ORDER_STATUS_OPTIONS.find((o) => o.value === status);
  return opt?.label ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusToColor(status: string) {
  if (status === "delivered" || status === "completed") return "text-green-700 bg-green-50 border-green-200";
  if (status === "shipped" || status === "out_for_delivery") return "text-blue-700 bg-blue-50 border-blue-200";
  if (status === "cancelled" || status === "refunded_to_wallet") return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

type AdminTab = "dashboard" | "products" | "orders" | "payments" | "analytics" | "others";

type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  category: string;
  subCategory: string;
  sizeOptions: string[];
  discountPrice: number;
  originalPrice: number;
  stockQty: number;
  isActive: boolean;
};

type ProductDraft = {
  stockQty: string;
  discountPrice: string;
  originalPrice: string;
  sizeOptionsInput: string;
  isActive: boolean;
};

type ProductCreatePayload = {
  name: string;
  description: string;
  sku: string;
  category: string;
  mainImageUrl: string;
  sizeOptionsInput: string;
  discountPrice: string;
  originalPrice: string;
  stockQty: string;
};

type NavItem = {
  id: AdminTab;
  label: string;
  icon:
    | "Home01Icon"
    | "ShoppingBag01Icon"
    | "ShoppingCart02Icon"
    | "MailSend01Icon"
    | "AiChat01Icon"
    | "Notification01Icon";
};

const adminNavItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "Home01Icon" },
  { id: "products", label: "Products", icon: "ShoppingBag01Icon" },
  { id: "orders", label: "Orders", icon: "ShoppingCart02Icon" },
  { id: "payments", label: "Payments", icon: "MailSend01Icon" },
  { id: "analytics", label: "Analytics", icon: "AiChat01Icon" },
  { id: "others", label: "Others", icon: "Notification01Icon" },
];

const initialProductPayload: ProductCreatePayload = {
  name: "",
  description: "",
  sku: "",
  category: "",
  mainImageUrl: "",
  sizeOptionsInput: "S, M, L, XL",
  discountPrice: "",
  originalPrice: "",
  stockQty: "",
};

function parseMultiSelectInput(value: string) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value.split(/[\n,|/]+/)) {
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }

    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(trimmed);
  }

  return normalized;
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildProductDraft(product: ProductListItem): ProductDraft {
  return {
    stockQty: String(product.stockQty),
    discountPrice: String(product.discountPrice),
    originalPrice: String(product.originalPrice),
    sizeOptionsInput: product.sizeOptions.join(", "),
    isActive: product.isActive,
  };
}

function getCardTone(index: number) {
  const tones = [
    "bg-[#fff4e4] border-primary/12",
    "bg-[#f8ead8] border-primary/15",
    "bg-[#f6efe0] border-primary/12",
    "bg-[#fdeed7] border-primary/14",
  ];

  return tones[index % tones.length] ?? tones[0];
}

function AdminDesktopSidebar({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-7.75rem)] w-full max-w-[16.5rem] rounded-3xl border border-primary/14 bg-secondary/85 p-3 shadow-[0_16px_40px_rgba(120,0,0,0.08)] backdrop-blur md:block">
      <p className="px-3 pb-2 pt-1 text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-primary/62">Admin Console</p>
      <nav aria-label="Admin sections" className="mt-1 space-y-1.5">
        {adminNavItems.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Open ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={`relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left text-sm font-semibold transition ${
                isActive ? "text-secondary" : "text-primary/80 hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId="admin-active-pill-desktop"
                  className="absolute inset-0 rounded-2xl bg-primary"
                  transition={{ type: "spring", stiffness: 420, damping: 35, mass: 0.7 }}
                  aria-hidden={true}
                />
              ) : null}
              <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-current/20">
                <DynamicHugeIcon name={item.icon} className="h-4.5 w-4.5" iconStrokeWidth={1.9} aria-hidden={true} />
              </span>
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function AdminMobileBottomBar({
  activeTab,
  onChange,
}: {
  activeTab: AdminTab;
  onChange: (tab: AdminTab) => void;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 bottom-0 z-[92] border-t border-primary/14 bg-secondary/95 px-2 pb-3 pt-2 shadow-[0_-14px_34px_rgba(120,0,0,0.13)] backdrop-blur md:hidden"
      aria-label="Admin quick navigation"
    >
      <nav aria-label="Admin bottom navigation" className="relative -mx-1 flex touch-manipulation gap-1 overflow-x-auto px-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {adminNavItems.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Open ${item.label}`}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(item.id)}
              className={`relative flex min-w-[5.8rem] shrink-0 flex-col items-center justify-center gap-1 rounded-[1rem] px-2 py-2 text-[0.7rem] font-semibold tracking-[0.01em] transition ${
                isActive ? "text-secondary" : "text-primary/75 hover:bg-primary/5 hover:text-primary"
              }`}
            >
              {isActive ? (
                <motion.span
                  layoutId="admin-active-pill-mobile"
                  className="absolute inset-0 rounded-[1rem] bg-primary"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 440, damping: 34, mass: 0.75 }
                  }
                  aria-hidden={true}
                />
              ) : null}
              <DynamicHugeIcon name={item.icon} className="relative z-10 h-4.5 w-4.5" iconStrokeWidth={2} aria-hidden={true} />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </motion.div>
  );
}

export function AdminDashboardClient() {
  const { isLoading, isAuthenticated, isAdmin, createAuthJwt, normalizeError } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>("dashboard");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [productPayload, setProductPayload] = useState<ProductCreatePayload>(initialProductPayload);
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [adminOrders, setAdminOrders] = useState<AdminOrder[]>([]);
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);
  const [orderStatusDraft, setOrderStatusDraft] = useState<Record<string, string>>({});
  const [orderStatusUpdating, setOrderStatusUpdating] = useState<Set<string>>(new Set());

  const canOpenDashboard = useMemo(() => !isLoading && isAuthenticated && isAdmin, [isAdmin, isAuthenticated, isLoading]);

  const loadOverview = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/overview", { method: "GET" });

      if (!response.ok) {
        if (response.status === 401) {
          setIsSessionReady(false);
          return;
        }

        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to fetch overview.");
      }

      const data = (await response.json()) as AdminOverview;
      setOverview(data);
      setIsSessionReady(true);
    } catch (error) {
      setStatusMessage(normalizeError(error));
    }
  }, [normalizeError]);

  const loadProducts = useCallback(async () => {
    setIsProductsLoading(true);

    try {
      const response = await fetch("/api/admin/products?limit=80", { method: "GET" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to fetch products.");
      }

      const payload = (await response.json()) as { products?: ProductListItem[] };
      const list = payload.products ?? [];
      setProducts(list);
      setProductDrafts(
        list.reduce<Record<string, ProductDraft>>((acc, product) => {
          acc[product.id] = buildProductDraft(product);
          return acc;
        }, {})
      );
    } catch (error) {
      setStatusMessage(normalizeError(error));
    } finally {
      setIsProductsLoading(false);
    }
  }, [normalizeError]);

  const loadAdminOrders = useCallback(async () => {
    setIsOrdersLoading(true);
    try {
      const response = await fetch("/api/admin/orders/list?limit=30", { method: "GET" });
      if (!response.ok) return;
      const data = (await response.json()) as { orders?: AdminOrder[] };
      const list = data.orders ?? [];
      setAdminOrders(list);
      // Initialise status drafts
      setOrderStatusDraft(list.reduce<Record<string, string>>((acc, o) => {
        acc[o.id] = o.status;
        return acc;
      }, {}));
    } catch { /* ignore */ }
    finally { setIsOrdersLoading(false); }
  }, []);

  async function updateOrderStatus(orderId: string, status: string) {
    setOrderStatusUpdating((prev) => new Set([...prev, orderId]));
    try {
      const formData = new FormData();
      formData.append("orderId", orderId);
      formData.append("status", status);
      formData.append("returnTo", "/admin?tab=orders");
      await fetch("/api/admin/orders/status", { method: "POST", body: formData, redirect: "manual" });
      // Refresh list after update
      await loadAdminOrders();
      setStatusMessage(`Order status updated to "${statusToLabel(status)}". Email sent to customer.`);
    } catch {
      setStatusMessage("Failed to update order status.");
    } finally {
      setOrderStatusUpdating((prev) => { const s = new Set(prev); s.delete(orderId); return s; });
    }
  }

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
      await loadOverview();
      await loadProducts();
    } catch (error) {
      setStatusMessage(normalizeError(error));
    } finally {
      setIsUnlocking(false);
    }
  }

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
          sizeOptions: parseMultiSelectInput(productPayload.sizeOptionsInput),
          discountPrice: Number(productPayload.discountPrice),
          originalPrice: Number(productPayload.originalPrice),
          stockQty: Number(productPayload.stockQty || 0),
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to create product.");
      }

      setProductPayload(initialProductPayload);
      setStatusMessage("Product created successfully.");
      await Promise.all([loadOverview(), loadProducts()]);
    } catch (error) {
      setStatusMessage(normalizeError(error));
    } finally {
      setIsSubmittingProduct(false);
    }
  }

  async function saveProductDraft(productId: string) {
    const draft = productDrafts[productId];
    if (!draft) {
      return;
    }

    setStatusMessage("");

    try {
      const response = await fetch(`/api/admin/products/${productId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockQty: Number(draft.stockQty || 0),
          discountPrice: Number(draft.discountPrice || 0),
          originalPrice: Number(draft.originalPrice || 0),
          sizeOptions: parseMultiSelectInput(draft.sizeOptionsInput),
          isActive: draft.isActive,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to update product.");
      }

      setStatusMessage("Product updated successfully.");
      await Promise.all([loadOverview(), loadProducts()]);
    } catch (error) {
      setStatusMessage(normalizeError(error));
    }
  }

  function updateProductDraft(productId: string, patch: Partial<ProductDraft>) {
    setProductDrafts((current) => {
      const existing = current[productId] ?? {
        stockQty: "0",
        discountPrice: "0",
        originalPrice: "0",
        sizeOptionsInput: "S, M, L, XL",
        isActive: true,
      };
      return {
        ...current,
        [productId]: {
          ...existing,
          ...patch,
        },
      };
    });
  }

  useEffect(() => {
    if (!canOpenDashboard) return;
    void loadOverview();
    void loadProducts();
  }, [canOpenDashboard, loadOverview, loadProducts]);

  useEffect(() => {
    if (isSessionReady && activeTab === "orders") {
      void loadAdminOrders();
    }
  }, [isSessionReady, activeTab, loadAdminOrders]);

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
    <main className="min-h-screen bg-paper px-3 pb-28 pt-20 text-primary sm:px-5 md:px-8 md:pb-10 md:pt-24">
      <section className="mx-auto flex w-full max-w-7xl gap-4 lg:gap-6">
        <AdminDesktopSidebar activeTab={activeTab} onChange={setActiveTab} />

        <div className="w-full flex-1">
          <div className="rounded-3xl border border-primary/16 bg-secondary p-5 shadow-[0_16px_44px_rgba(120,0,0,0.08)] sm:p-6">
            <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-primary/65">NaariThread Console</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="font-display text-[1.95rem] leading-[1.02] sm:text-[2.4rem]">Admin Dashboard</h1>
                <p className="mt-2 text-sm text-primary/78">
                  Mobile-first control room for products, orders, payments, analytics, banners, and coupons.
                </p>
              </div>
              {!isSessionReady ? (
                <button
                  type="button"
                  aria-label="Unlock admin gateway"
                  onClick={() => void unlockAdminGateway()}
                  disabled={isUnlocking}
                  className="cta-thread disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUnlocking ? "Unlocking..." : "Unlock Admin Gateway"}
                </button>
              ) : (
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-paper px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary/75">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden={true} />
                  Session Ready
                </span>
              )}
            </div>

            {statusMessage ? <p className="mt-4 text-sm text-primary/82">{statusMessage}</p> : null}
          </div>

          {isSessionReady && activeTab === "dashboard" ? (
            <section className="mt-4 grid grid-cols-2 gap-3 sm:mt-5 sm:grid-cols-4 sm:gap-4">
              {[
                { label: "Products", value: overview?.products ?? 0 },
                { label: "Orders", value: overview?.orders ?? 0 },
                { label: "Payments", value: overview?.payments ?? 0 },
                { label: "Reviews", value: overview?.reviews ?? 0 },
              ].map((item, index) => (
                <motion.article
                  key={item.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: index * 0.03 }}
                  className={`rounded-2xl border p-4 sm:p-5 ${getCardTone(index)}`}
                >
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold leading-none sm:mt-3">{item.value}</p>
                </motion.article>
              ))}
            </section>
          ) : null}

          {isSessionReady && activeTab === "products" ? (
            <section className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
              <article className="rounded-3xl border border-primary/14 bg-secondary p-4 sm:p-6">
                <h2 className="text-xl font-semibold sm:text-2xl">Create Product</h2>
                <p className="mt-1.5 text-sm text-primary/72">Add product details and publish instantly in catalog.</p>
                <form onSubmit={handleCreateProduct} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { key: "name", label: "Name" },
                    { key: "sku", label: "SKU" },
                    { key: "category", label: "Category" },
                    { key: "mainImageUrl", label: "Main Image URL" },
                    { key: "sizeOptionsInput", label: "Sizes (Comma separated)" },
                    { key: "discountPrice", label: "Discount Price" },
                    { key: "originalPrice", label: "Original Price" },
                    { key: "stockQty", label: "Stock Qty" },
                  ].map((field) => (
                    <label key={field.key} className="flex flex-col gap-1.5">
                      <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">{field.label}</span>
                      <input
                        aria-label={field.label}
                        value={productPayload[field.key as keyof ProductCreatePayload]}
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
                    <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Description</span>
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
              </article>

              <article className="rounded-3xl border border-primary/14 bg-secondary p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold sm:text-xl">Product Inventory</h3>
                  <button
                    type="button"
                    aria-label="Refresh products"
                    onClick={() => void loadProducts()}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-primary/20 bg-paper px-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:border-primary/45"
                  >
                    Refresh
                  </button>
                </div>

                {isProductsLoading ? (
                  <p className="text-sm text-primary/72">Loading products...</p>
                ) : products.length === 0 ? (
                  <p className="text-sm text-primary/72">No products found yet.</p>
                ) : (
                  <div className="space-y-3">
                    {products.slice(0, 16).map((product) => {
                      const draft = productDrafts[product.id] ?? buildProductDraft(product);
                      return (
                        <div key={product.id} className="rounded-2xl border border-primary/12 bg-paper p-3.5 sm:p-4">
                          <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-primary">{product.name}</p>
                              <p className="text-[0.65rem] uppercase tracking-[0.16em] text-primary/62">
                                {product.category} • {product.subCategory}
                              </p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.16em] ${draft.isActive ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                              {draft.isActive ? "Active" : "Hidden"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Discount</span>
                              <input
                                aria-label={`Discount price for ${product.name}`}
                                value={draft.discountPrice}
                                onChange={(event) => updateProductDraft(product.id, { discountPrice: event.target.value })}
                                className="h-10 rounded-lg border border-primary/15 bg-secondary px-2.5 text-sm"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Original</span>
                              <input
                                aria-label={`Original price for ${product.name}`}
                                value={draft.originalPrice}
                                onChange={(event) => updateProductDraft(product.id, { originalPrice: event.target.value })}
                                className="h-10 rounded-lg border border-primary/15 bg-secondary px-2.5 text-sm"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Stock</span>
                              <input
                                aria-label={`Stock quantity for ${product.name}`}
                                value={draft.stockQty}
                                onChange={(event) => updateProductDraft(product.id, { stockQty: event.target.value })}
                                className="h-10 rounded-lg border border-primary/15 bg-secondary px-2.5 text-sm"
                              />
                            </label>
                            <label className="col-span-2 flex flex-col gap-1 sm:col-span-5">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Sizes (Comma separated)</span>
                              <input
                                aria-label={`Sizes for ${product.name}`}
                                value={draft.sizeOptionsInput}
                                onChange={(event) => updateProductDraft(product.id, { sizeOptionsInput: event.target.value })}
                                className="h-10 rounded-lg border border-primary/15 bg-secondary px-2.5 text-sm"
                                placeholder="XS, S, M, L"
                              />
                            </label>
                            <label className="col-span-2 flex h-full items-end sm:col-span-1">
                              <button
                                type="button"
                                aria-label={`${draft.isActive ? "Hide" : "Activate"} ${product.name}`}
                                onClick={() => updateProductDraft(product.id, { isActive: !draft.isActive })}
                                className="h-10 w-full rounded-lg border border-primary/18 bg-secondary px-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/40"
                              >
                                {draft.isActive ? "Hide" : "Activate"}
                              </button>
                            </label>
                            <button
                              type="button"
                              aria-label={`Save ${product.name}`}
                              onClick={() => void saveProductDraft(product.id)}
                              className="col-span-2 h-10 rounded-lg border border-primary bg-primary px-3 text-xs font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90 sm:col-span-1"
                            >
                              Save
                            </button>
                          </div>

                          <p className="mt-2 text-xs text-primary/62">
                            Live price: {formatPrice(Number(draft.discountPrice || 0))} • MRP: {formatPrice(Number(draft.originalPrice || 0))} • Sizes: {parseMultiSelectInput(draft.sizeOptionsInput).join(", ") || "-"}
                          </p>
                        </div>
                      );
                    })}
                    {products.length > 16 ? (
                      <p className="text-xs text-primary/62">Showing first 16 products for quick edit in mobile-friendly mode.</p>
                    ) : null}
                  </div>
                )}
              </article>
            </section>
          ) : null}

          {isSessionReady && activeTab === "orders" ? (
            <section className="mt-4 space-y-4 sm:mt-5">
              {/* Stats */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-primary/12 bg-secondary p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Total Orders</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.orders ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-primary/12 bg-secondary p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Pending Fulfillment</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.pendingFulfillment ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-primary/12 bg-secondary p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Delivered</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.delivered ?? 0}</p>
                </article>
              </div>

              {/* Orders list */}
              <div className="rounded-3xl border border-primary/14 bg-secondary p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold sm:text-2xl">Recent Orders</h2>
                  <button type="button" onClick={() => void loadAdminOrders()} disabled={isOrdersLoading} aria-label="Refresh orders"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-primary/20 text-primary/70 transition hover:border-primary/50 hover:text-primary disabled:opacity-40">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>

                {isOrdersLoading ? (
                  <div className="mt-6 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 animate-pulse rounded-2xl bg-primary/5" />
                    ))}
                  </div>
                ) : adminOrders.length === 0 ? (
                  <p className="mt-6 text-sm text-primary/60">No orders found.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {adminOrders.map((order) => {
                      const draft = orderStatusDraft[order.id] ?? order.status;
                      const isUpdating = orderStatusUpdating.has(order.id);
                      const hasPendingChange = draft !== order.status;
                      const date = new Date(order.placedAt);
                      const dateStr = Number.isFinite(date.getTime())
                        ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : "—";

                      return (
                        <article key={order.id} className="rounded-2xl border border-primary/12 bg-paper p-4">
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{order.orderNumber}</span>
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${statusToColor(order.status)}`}>
                                  {statusToLabel(order.status)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-primary/55">{order.userEmail} · {dateStr}</p>
                              <p className="mt-1 text-xs text-primary/70">
                                {order.items.slice(0, 2).map((item) => `${item.productName} ×${item.quantity}`).join(" · ")}
                                {order.items.length > 2 ? ` + ${order.items.length - 2} more` : ""}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold">{formatPrice(order.totalAmount)}</p>
                              <p className="mt-0.5 text-[0.62rem] uppercase tracking-[0.1em] text-primary/50">{order.paymentStatus}</p>
                            </div>
                          </div>

                          {/* Status update row */}
                          {order.paymentStatus === "paid" || order.status !== "cancelled" ? (
                            <div className="mt-3 flex items-center gap-2 border-t border-primary/10 pt-3">
                              <select
                                aria-label={`Update status for ${order.orderNumber}`}
                                value={draft}
                                disabled={isUpdating}
                                onChange={(e) => setOrderStatusDraft((prev) => ({ ...prev, [order.id]: e.target.value }))}
                                className="flex-1 rounded-lg border border-primary/20 bg-secondary px-2.5 py-1.5 text-xs font-semibold text-primary outline-none transition focus:border-primary/50 disabled:opacity-50"
                              >
                                {ORDER_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                              </select>
                              {hasPendingChange && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => void updateOrderStatus(order.id, draft)}
                                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-secondary transition hover:bg-primary/85 disabled:opacity-50"
                                >
                                  {isUpdating ? "Updating…" : "Confirm & Email"}
                                </button>
                              )}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          ) : null}

          {isSessionReady && activeTab === "payments" ? (
            <section className="mt-4 rounded-3xl border border-primary/14 bg-secondary p-4 sm:mt-5 sm:p-6">
              <h2 className="text-xl font-semibold sm:text-2xl">Payments</h2>
              <p className="mt-2 text-sm text-primary/75">Monitor reconciliation status and payment volume at a glance.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-primary/12 bg-paper p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Total Payments</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.payments ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-primary/12 bg-paper p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Completed Orders</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.delivered ?? 0}</p>
                </article>
                <article className="rounded-2xl border border-primary/12 bg-paper p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Pending Fulfillment</p>
                  <p className="mt-2 text-3xl font-semibold">{overview?.pendingFulfillment ?? 0}</p>
                </article>
              </div>
              {/* TODO: Connect payment gateway timeline and settlement export when payment endpoints are implemented. */}
            </section>
          ) : null}

          {isSessionReady && activeTab === "analytics" ? (
            <section className="mt-4 rounded-3xl border border-primary/14 bg-secondary p-4 sm:mt-5 sm:p-6">
              <h2 className="text-xl font-semibold sm:text-2xl">Analytics</h2>
              <p className="mt-2 text-sm text-primary/75">Luxury performance snapshot for product demand and revenue confidence.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <article className="rounded-2xl border border-primary/12 bg-paper p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Catalog Growth</p>
                  <p className="mt-2 text-2xl font-semibold">+{Math.max(3, Math.floor((overview?.products ?? 0) * 0.1))}%</p>
                  <p className="mt-1 text-xs text-primary/62">Compared with previous cycle.</p>
                </article>
                <article className="rounded-2xl border border-primary/12 bg-paper p-4">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Review Velocity</p>
                  <p className="mt-2 text-2xl font-semibold">{overview?.reviews ?? 0} Signals</p>
                  <p className="mt-1 text-xs text-primary/62">Fresh customer sentiment across catalog.</p>
                </article>
              </div>
              {/* TODO: Replace derived metrics with real chart data once analytics endpoint is added. */}
            </section>
          ) : null}

          {isSessionReady && activeTab === "others" ? (
            <section className="mt-4 space-y-4 sm:mt-5 sm:space-y-5">
              <article className="rounded-3xl border border-primary/14 bg-secondary p-4 sm:p-6">
                <h2 className="text-xl font-semibold sm:text-2xl">Banners</h2>
                <p className="mt-2 text-sm text-primary/75">Manage homepage campaign banners from one panel.</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Banner Title</span>
                    <input aria-label="Banner title" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" placeholder="Festive Edit 2026" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Banner Image URL</span>
                    <input aria-label="Banner image URL" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" placeholder="https://..." />
                  </label>
                  <label className="sm:col-span-2 flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">CTA Link</span>
                    <input aria-label="Banner CTA link" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" placeholder="/products?tag=festive" />
                  </label>
                </div>
                <button type="button" aria-label="Save banner" className="cta-thread mt-4">Save Banner</button>
                {/* TODO: Persist banners to Appwrite collection when banner APIs are ready. */}
              </article>

              <article className="rounded-3xl border border-primary/14 bg-secondary p-4 sm:p-6">
                <h2 className="text-xl font-semibold sm:text-2xl">Discount Coupons</h2>
                <p className="mt-2 text-sm text-primary/75">Create promo codes for campaigns and festive drops.</p>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Code</span>
                    <input aria-label="Coupon code" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" placeholder="NAARI25" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount %</span>
                    <input aria-label="Coupon discount percentage" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" placeholder="25" />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Expiry</span>
                    <input aria-label="Coupon expiry date" type="date" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                  </label>
                </div>
                <button type="button" aria-label="Create coupon" className="cta-thread mt-4">Create Coupon</button>
                {/* TODO: Store coupon rules and redemption limits in backend when coupon APIs are implemented. */}
              </article>
            </section>
          ) : null}
        </div>
      </section>

      <AdminMobileBottomBar activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
