import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ID, Query } from "node-appwrite";

import { AdminMobileBottomBar } from "@/app/components/admin-mobile-bottom-bar";
import { AdminSessionBootstrap } from "@/app/components/admin-session-bootstrap";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { ensureSlug } from "@/lib/slug";
import { SearchIcon } from "@hugeicons/core-free-icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;
type AdminTab = "dashboard" | "products" | "addons" | "orders" | "payments";
type AddonType = "banners" | "coupons";

type AdminProduct = {
  id: string;
  name: string;
  description: string;
  sku: string;
  slug: string;
  category: string;
  subCategory: string;
  mainImageUrl: string;
  otherImageUrls: string[];
  discountPrice: number;
  originalPrice: number;
  stockQty: number;
  inStock: boolean;
  sizeOptions: string[];
  colorOptions: string[];
  isActive: boolean;
  createdAt: string;
};

type AdminAddon = {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  usageCount: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  discountPercent: number;
  minOrderValue: number;
};

type AdminTransaction = {
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  status: string;
  createdAt: string;
  raw: Record<string, unknown>;
};

type Overview = {
  products: number;
  orders: number;
  payments: number;
  reviews: number;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function parseCommaSeparated(value: string) {
  return toStringArray(value.split(","));
}

function isDocumentMissingError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? Number((error as { code?: unknown }).code) : NaN;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return code === 404 || message.toLowerCase().includes("not found");
}

function getFirstParam(searchParams: SearchParams, key: string, fallback = "") {
  const value = searchParams[key];

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }

  return fallback;
}

function getPositiveInt(searchParams: SearchParams, key: string, fallback: number) {
  const value = Number(getFirstParam(searchParams, key, String(fallback)));
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.trunc(value);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function mapProduct(document: Record<string, unknown>): AdminProduct {
  const stockQty = toNumber(document.stockQty);
  const inStockField = toBoolean(document.inStock, stockQty > 0);

  return {
    id: String(document.$id ?? ""),
    name: String(document.name ?? "Untitled Product"),
    description: String(document.description ?? ""),
    sku: String(document.sku ?? ""),
    slug: String(document.slug ?? ""),
    category: String(document.category ?? ""),
    subCategory: String(document.subCategory ?? document.subcategory ?? ""),
    mainImageUrl: String(document.mainImageUrl ?? document.mainImage ?? ""),
    otherImageUrls: toStringArray(document.otherImageUrls),
    discountPrice: toNumber(document.discountPrice),
    originalPrice: toNumber(document.originalPrice),
    stockQty,
    inStock: inStockField,
    sizeOptions: toStringArray(document.sizeOptions),
    colorOptions: toStringArray(document.colorOptions),
    isActive: toBoolean(document.isActive, true),
    createdAt: String(document.$createdAt ?? ""),
  };
}

function mapAddon(document: Record<string, unknown>): AdminAddon {
  return {
    id: String(document.$id ?? ""),
    title: String(document.title ?? document.name ?? "Untitled"),
    subtitle: String(document.subtitle ?? document.description ?? ""),
    code: String(document.code ?? ""),
    usageCount: toNumber(document.usageCount ?? document.usedCount ?? document.redemptionCount ?? document.totalRedemptions),
    isActive: toBoolean(document.isActive, true),
    startsAt: String(document.startAt ?? document.startsAt ?? ""),
    endsAt: String(document.endAt ?? document.expiresAt ?? ""),
    imageUrl: String(document.imageUrl ?? ""),
    ctaLabel: String(document.ctaLabel ?? ""),
    ctaUrl: String(document.ctaUrl ?? ""),
    discountPercent: toNumber(document.discountPercent ?? document.discount ?? document.value),
    minOrderValue: toNumber(document.minOrderValue ?? document.minimumOrderValue),
  };
}

function mapTransaction(document: Record<string, unknown>, fallbackLabel: string): AdminTransaction {
  return {
    id: String(document.$id ?? ""),
    title: String(document.orderId ?? document.reference ?? document.title ?? fallbackLabel),
    subtitle: String(document.customerName ?? document.email ?? document.phone ?? ""),
    amount: toNumber(document.amount ?? document.totalAmount ?? document.payableAmount),
    status: String(document.status ?? document.paymentStatus ?? "Pending"),
    createdAt: String(document.transactionDate ?? document.createdAt ?? document.$createdAt ?? ""),
    raw: document,
  };
}

async function listDocumentsFromCandidates(
  collectionIds: string[],
  queries: string[]
): Promise<{ collectionId: string | null; documents: Record<string, unknown>[]; total: number }> {
  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();

  for (const collectionId of collectionIds) {
    try {
      const result = await databases.listDocuments(databaseId, collectionId, queries);
      return {
        collectionId,
        documents: result.documents as unknown as Record<string, unknown>[],
        total: result.total,
      };
    } catch (error) {
      if (!isDocumentMissingError(error)) {
        throw error;
      }
    }
  }

  return {
    collectionId: null,
    documents: [],
    total: 0,
  };
}

async function getDocumentFromCandidates(collectionIds: string[], id: string) {
  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();

  for (const collectionId of collectionIds) {
    try {
      const document = await databases.getDocument(databaseId, collectionId, id);
      return {
        collectionId,
        document: document as unknown as Record<string, unknown>,
      };
    } catch (error) {
      if (!isDocumentMissingError(error)) {
        throw error;
      }
    }
  }

  return {
    collectionId: null,
    document: null,
  };
}

function buildAdminHref(searchParams: SearchParams, patch: Record<string, string | null>) {
  const params = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (typeof rawValue === "string") {
      params.set(key, rawValue);
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value.length === 0) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `/admin?${qs}` : "/admin";
}

function serializeForDetail(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (value === undefined || value === null || value === "") {
    return "-";
  }

  return String(value);
}

function getActiveTab(value: string): AdminTab {
  if (value === "dashboard" || value === "products" || value === "addons" || value === "orders" || value === "payments") {
    return value;
  }

  return "dashboard";
}

function getActiveAddon(value: string): AddonType {
  if (value === "banners" || value === "coupons") {
    return value;
  }

  return "banners";
}

async function toggleProductStockAction(formData: FormData) {
  "use server";

  const productId = String(formData.get("productId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin").trim() || "/admin";
  const currentStockQty = toNumber(formData.get("stockQty"));
  const currentInStock = toBoolean(formData.get("inStock"), currentStockQty > 0);

  if (!productId) {
    redirect(returnTo);
  }

  const nextInStock = !currentInStock;
  const nextStockQty = nextInStock ? Math.max(1, currentStockQty) : 0;

  const databases = createDatabasesWithApiKey();
  await databases.updateDocument(getDatabaseId(), "sku", productId, {
    inStock: nextInStock,
    stockQty: nextStockQty,
  });

  redirect(returnTo);
}

async function saveProductAction(formData: FormData) {
  "use server";

  const productId = String(formData.get("productId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin").trim() || "/admin";

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    slug: ensureSlug(String(formData.get("slug") ?? "").trim(), productId || "sku"),
    category: String(formData.get("category") ?? "").trim(),
    subCategory: String(formData.get("subCategory") ?? "").trim(),
    mainImageUrl: String(formData.get("mainImageUrl") ?? "").trim(),
    discountPrice: toNumber(formData.get("discountPrice")),
    originalPrice: toNumber(formData.get("originalPrice")),
    stockQty: toNumber(formData.get("stockQty")),
    inStock: toBoolean(formData.get("inStock"), false),
    sizeOptions: parseCommaSeparated(String(formData.get("sizeOptions") ?? "")),
    colorOptions: parseCommaSeparated(String(formData.get("colorOptions") ?? "")),
    otherImageUrls: parseCommaSeparated(String(formData.get("otherImageUrls") ?? "")),
    isActive: toBoolean(formData.get("isActive"), true),
  };

  const databases = createDatabasesWithApiKey();

  if (productId) {
    await databases.updateDocument(getDatabaseId(), "sku", productId, payload);
  } else {
    await databases.createDocument(getDatabaseId(), "sku", ID.unique(), payload);
  }

  redirect(returnTo);
}

async function saveAddonAction(formData: FormData) {
  "use server";

  const addonType = String(formData.get("addonType") ?? "").trim().toLowerCase() === "coupons" ? "coupons" : "banners";
  const addonId = String(formData.get("addonId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin").trim() || "/admin";

  const collectionIds = addonType === "banners" ? ["banners", "banner"] : ["coupons", "coupon"];
  const candidate = await listDocumentsFromCandidates(collectionIds, [Query.limit(1)]);
  const collectionId = candidate.collectionId ?? collectionIds[0];

  const payload: Record<string, unknown> = addonType === "banners"
    ? {
        title: String(formData.get("title") ?? "").trim(),
        subtitle: String(formData.get("subtitle") ?? "").trim(),
        imageUrl: String(formData.get("imageUrl") ?? "").trim(),
        ctaLabel: String(formData.get("ctaLabel") ?? "").trim(),
        ctaUrl: String(formData.get("ctaUrl") ?? "").trim(),
        usageCount: toNumber(formData.get("usageCount")),
        isActive: toBoolean(formData.get("isActive"), true),
      }
    : {
        title: String(formData.get("title") ?? "").trim(),
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        subtitle: String(formData.get("subtitle") ?? "").trim(),
        discountPercent: toNumber(formData.get("discountPercent")),
        minOrderValue: toNumber(formData.get("minOrderValue")),
        usageCount: toNumber(formData.get("usageCount")),
        isActive: toBoolean(formData.get("isActive"), true),
      };

  const databases = createDatabasesWithApiKey();
  if (addonId) {
    await databases.updateDocument(getDatabaseId(), collectionId, addonId, payload);
  } else {
    await databases.createDocument(getDatabaseId(), collectionId, ID.unique(), payload);
  }

  redirect(returnTo);
}

function AdminPagination({
  page,
  total,
  pageSize,
  prevHref,
  nextHref,
}: {
  page: number;
  total: number;
  pageSize: number;
  prevHref: string;
  nextHref: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/14 bg-secondary px-3 py-2.5 text-sm">
      <p className="text-primary/80">
        Page {page} of {pages}
      </p>
      <div className="flex items-center gap-2">
        <Link
          href={prevHref}
          aria-label="Go to previous page"
          className={`rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            page <= 1 ? "pointer-events-none opacity-45" : "hover:border-primary/40"
          }`}
        >
          Prev
        </Link>
        <Link
          href={nextHref}
          aria-label="Go to next page"
          className={`rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            page >= pages ? "pointer-events-none opacity-45" : "hover:border-primary/40"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

function AdminModal({
  title,
  backHref,
  children,
}: {
  title: string;
  backHref: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end bg-primary/45 p-3 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-primary/15 bg-secondary p-4 shadow-[0_24px_48px_rgba(40,0,0,0.24)] sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold sm:text-2xl">{title}</h2>
          <Link
            href={backHref}
            aria-label="Go back from modal"
            className="rounded-xl border border-primary/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary/80 transition hover:border-primary/42"
          >
            Go Back
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = getActiveTab(getFirstParam(resolvedSearchParams, "tab", "dashboard"));
  const activeAddon = getActiveAddon(getFirstParam(resolvedSearchParams, "addon", "banners"));
  const productPage = getPositiveInt(resolvedSearchParams, "page", 1);
  const productQuery = getFirstParam(resolvedSearchParams, "q").trim().toLowerCase();
  const addonPage = getPositiveInt(resolvedSearchParams, "addonsPage", 1);
  const ordersPage = getPositiveInt(resolvedSearchParams, "ordersPage", 1);
  const paymentsPage = getPositiveInt(resolvedSearchParams, "paymentsPage", 1);
  const modal = getFirstParam(resolvedSearchParams, "modal");
  const entityId = getFirstParam(resolvedSearchParams, "id");
  const productPageSize = 12;
  const addonPageSize = 10;
  const transactionPageSize = 8;

  const cookieStore = await cookies();
  const hasAdminSession = Boolean(cookieStore.get("nt_admin_session")?.value);

  if (!hasAdminSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 pb-24 text-primary md:pb-16 md:pt-20">
        <AdminSessionBootstrap />
      </main>
    );
  }

  const [productsCount, ordersCount, paymentsCount, reviewsCount] = await Promise.all([
    listDocumentsFromCandidates(["sku"], [Query.limit(1)]).then((result) => result.total).catch(() => 0),
    listDocumentsFromCandidates(["orders"], [Query.limit(1)]).then((result) => result.total).catch(() => 0),
    listDocumentsFromCandidates(["payments"], [Query.limit(1)]).then((result) => result.total).catch(() => 0),
    listDocumentsFromCandidates(["reviews"], [Query.limit(1)]).then((result) => result.total).catch(() => 0),
  ]);

  const overview: Overview = {
    products: productsCount,
    orders: ordersCount,
    payments: paymentsCount,
    reviews: reviewsCount,
  };

  let products: AdminProduct[] = [];
  let productsTotal = 0;
  if (activeTab === "products") {
    if (productQuery) {
      const result = await listDocumentsFromCandidates(["sku"], [
        Query.limit(100),
        Query.orderDesc("$createdAt"),
      ]);

      const filtered = result.documents
        .map((document) => mapProduct(document))
        .filter((product) => {
          const haystack = `${product.name} ${product.sku} ${product.category} ${product.subCategory}`.toLowerCase();
          return haystack.includes(productQuery);
        });

      productsTotal = filtered.length;
      const offset = (productPage - 1) * productPageSize;
      products = filtered.slice(offset, offset + productPageSize);
    } else {
      const result = await listDocumentsFromCandidates(["sku"], [
        Query.limit(productPageSize),
        Query.offset((productPage - 1) * productPageSize),
        Query.orderDesc("$createdAt"),
      ]);

      productsTotal = result.total;
      products = result.documents.map((document) => mapProduct(document));
    }
  }

  let addons: AdminAddon[] = [];
  let addonsTotal = 0;
  if (activeTab === "addons") {
    const addonCollections = activeAddon === "banners" ? ["banners", "banner"] : ["coupons", "coupon"];
    const result = await listDocumentsFromCandidates(addonCollections, [
      Query.limit(addonPageSize),
      Query.offset((addonPage - 1) * addonPageSize),
      Query.orderDesc("$createdAt"),
    ]);
    addonsTotal = result.total;
    addons = result.documents.map((document) => mapAddon(document));
  }

  let orderItems: AdminTransaction[] = [];
  let orderTotal = 0;
  let paymentItems: AdminTransaction[] = [];
  let paymentTotal = 0;

  if (activeTab === "orders") {
    const ordersResult = await listDocumentsFromCandidates(["orders"], [
      Query.limit(transactionPageSize),
      Query.offset((ordersPage - 1) * transactionPageSize),
      Query.orderDesc("$createdAt"),
    ]);

    orderTotal = ordersResult.total;
    orderItems = ordersResult.documents.map((document) => mapTransaction(document, "Order"));
  }

  if (activeTab === "payments") {
    const paymentsResult = await listDocumentsFromCandidates(["payments"], [
      Query.limit(transactionPageSize),
      Query.offset((paymentsPage - 1) * transactionPageSize),
      Query.orderDesc("$createdAt"),
    ]);

    paymentTotal = paymentsResult.total;
    paymentItems = paymentsResult.documents.map((document) => mapTransaction(document, "Payment"));
  }

  let modalDocument: Record<string, unknown> | null = null;
  let modalDocumentType: "product" | "banner" | "coupon" | "order" | "payment" | null = null;

  if (entityId && modal) {
    if (modal.startsWith("product-")) {
      const result = await getDocumentFromCandidates(["sku"], entityId);
      modalDocument = result.document;
      modalDocumentType = result.document ? "product" : null;
    } else if (modal.startsWith("banner-")) {
      const result = await getDocumentFromCandidates(["banners", "banner"], entityId);
      modalDocument = result.document;
      modalDocumentType = result.document ? "banner" : null;
    } else if (modal.startsWith("coupon-")) {
      const result = await getDocumentFromCandidates(["coupons", "coupon"], entityId);
      modalDocument = result.document;
      modalDocumentType = result.document ? "coupon" : null;
    } else if (modal.startsWith("order-")) {
      const result = await getDocumentFromCandidates(["orders"], entityId);
      modalDocument = result.document;
      modalDocumentType = result.document ? "order" : null;
    } else if (modal.startsWith("payment-")) {
      const result = await getDocumentFromCandidates(["payments"], entityId);
      modalDocument = result.document;
      modalDocumentType = result.document ? "payment" : null;
    }
  }

  const baseWithoutModal = buildAdminHref(resolvedSearchParams, { modal: null, id: null });

  return (
    <main className="min-h-screen bg-paper px-5 pb-24 pt-2 text-primary sm:px-5 sm:pt-16 md:px-8 md:pb-10 md:pt-24">
      <section className="mx-auto hidden w-full max-w-7xl md:block">
        <nav aria-label="Admin sections" className="grid grid-cols-5 gap-2">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "products", label: "Products" },
            { id: "addons", label: "AddOns" },
            { id: "orders", label: "Orders" },
            { id: "payments", label: "Payments" },
          ].map((item) => {
            const href = buildAdminHref(resolvedSearchParams, {
              tab: item.id,
              modal: null,
              id: null,
            });

            const isActive = item.id === activeTab;

            return (
              <Link
                key={item.id}
                href={href}
                aria-label={`Open ${item.label}`}
                aria-current={isActive ? "page" : undefined}
                className={`rounded-2xl px-3 py-3 text-center text-sm font-semibold transition ${
                  isActive ? "bg-primary text-secondary" : "border border-primary/14 text-primary/82 hover:border-primary/35"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </section>

      {activeTab === "dashboard" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl">
          

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {[
              { label: "Products", value: overview.products },
              { label: "Orders", value: overview.orders },
              { label: "Payments", value: overview.payments },
              { label: "Reviews", value: overview.reviews },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-primary/12 bg-[#fff4e4] p-4 sm:p-5">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-primary/62">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold leading-none sm:mt-3">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              href="/products"
              aria-label="Open products page"
              className="rounded-xl border border-secondary/20 bg-primary px-3 py-2 text-secondary text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-secondary/45 hover:scale-95"
            >
              Open Products Page
            </Link>
          </div>
        </section>
      ) : null}

      {activeTab === "products" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">Products</h2>
              <p className="mt-1 text-sm text-primary/72">Two-column compact admin cards for quick actions.</p>
            </div>

            <div className="flex w-full flex-wrap items-center justify-between md:justify-end gap-2 sm:w-auto">
              <form action="/admin" method="GET" className="flex items-center gap-2">
                <input type="hidden" name="tab" value="products" />
                <input
                  aria-label="Search products"
                  name="q"
                  defaultValue={productQuery}
                  placeholder="Search name, sku, category"
                  className="h-10 w-[14rem] rounded-xl border border-primary/20 bg-paper px-3 text-sm outline-none transition focus:border-primary"
                />
                <button
                  type="submit"
                  aria-label="Search products"
                  className="sm:block hidden rounded-xl border border-primary/20 bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary/45"
                >
                  Search
                  
                </button>
              </form>

              <Link
                href={buildAdminHref(resolvedSearchParams, { modal: "product-create", id: null })}
                aria-label="Add new product"
                className="rounded-xl border border-primary/20 bg-paper px-3 py-3 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary/45 "
              >
                Add New
              </Link>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-sm text-primary/72">No products found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => {
                const price = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
                const imageSrc = product.mainImageUrl || product.otherImageUrls[0] || "/logo4.png";
                const isInStock = product.inStock;

                return (
                  <article key={product.id} className="rounded-2xl border border-primary/12 bg-[#fbf5e6] p-2.5">
                    <div className="relative mb-2.5 overflow-hidden rounded-xl border border-primary/10 bg-paper/60">
                      <div className="relative aspect-[4/3] w-full">
                        <CloudinaryImage
                          src={imageSrc}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 40vw, 220px"
                          className="object-cover"
                        />
                      </div>
                      {!isInStock ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-[2] bg-[#fbf5e6]/40 backdrop-grayscale-[0.5]"
                          aria-hidden={true}
                        />
                      ) : null}
                    </div>
                    <p className="line-clamp-2 text-sm font-semibold leading-tight text-primary">{product.name}</p>
                    <p className="mt-1 text-sm font-semibold text-primary/90">{formatPrice(price)}</p>

                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <Link
                        href={buildAdminHref(resolvedSearchParams, { modal: "product-edit", id: product.id })}
                        aria-label={`Edit ${product.name}`}
                        className="rounded-lg border border-primary/20 bg-paper px-2 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80 transition hover:border-primary/40"
                      >
                        Edit
                      </Link>
                      <Link
                        href={buildAdminHref(resolvedSearchParams, { modal: "product-view", id: product.id })}
                        aria-label={`View ${product.name}`}
                        className="rounded-lg border border-primary/20 bg-paper px-2 py-1.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80 transition hover:border-primary/40"
                      >
                        View
                      </Link>
                      <form action={toggleProductStockAction}>
                        <input type="hidden" name="productId" value={product.id} />
                        <input type="hidden" name="stockQty" value={String(product.stockQty)} />
                        <input type="hidden" name="inStock" value={String(isInStock)} />
                        <input type="hidden" name="returnTo" value={buildAdminHref(resolvedSearchParams, {})} />
                        <button
                          type="submit"
                          aria-label={`Toggle ${product.name} stock`}
                          className={`inline-flex w-full items-center justify-center rounded-lg px-2 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition ${
                            isInStock
                              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border border-amber-200 bg-amber-50 text-amber-700"
                          }`}
                        >
                          <span aria-hidden={true} className="inline-block h-2.5 w-2.5 rounded-full bg-current" />
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <AdminPagination
            page={productPage}
            total={productsTotal}
            pageSize={productPageSize}
            prevHref={buildAdminHref(resolvedSearchParams, { page: String(Math.max(1, productPage - 1)) })}
            nextHref={buildAdminHref(resolvedSearchParams, { page: String(productPage + 1) })}
          />
        </section>
      ) : null}

      {activeTab === "addons" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold sm:text-2xl">AddOns</h2>
              <p className="mt-1 text-sm text-primary/72">Manage banners and coupons with live counts and details.</p>
            </div>
            <Link
              href={buildAdminHref(resolvedSearchParams, {
                modal: activeAddon === "banners" ? "banner-create" : "coupon-create",
                id: null,
              })}
              aria-label="Add new addon"
              className="rounded-xl border border-primary/20 bg-paper px-3 py-2 text-xs font-semibold uppercase tracking-[0.15em] transition hover:border-primary/45"
            >
              Add New
            </Link>
          </div>

          <div className="mb-3 flex gap-2">
            <Link
              href={buildAdminHref(resolvedSearchParams, { addon: "banners", addonsPage: "1" })}
              aria-label="Open banners list"
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                activeAddon === "banners" ? "bg-primary text-secondary" : "border border-primary/20 text-primary/80"
              }`}
            >
              Banners
            </Link>
            <Link
              href={buildAdminHref(resolvedSearchParams, { addon: "coupons", addonsPage: "1" })}
              aria-label="Open coupons list"
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${
                activeAddon === "coupons" ? "bg-primary text-secondary" : "border border-primary/20 text-primary/80"
              }`}
            >
              Coupons
            </Link>
          </div>

          {addons.length === 0 ? (
            <p className="text-sm text-primary/72">No {activeAddon} found in database.</p>
          ) : (
            <div className="divide-y divide-primary/10 rounded-2xl border border-primary/12 bg-paper">
              {addons.map((addon) => (
                <article key={addon.id} className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">{activeAddon === "coupons" ? addon.code || addon.title : addon.title}</p>
                    <p className="mt-1 text-xs text-primary/70">{addon.subtitle || "No subtitle"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-primary/16 bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/78">
                      Usage {addon.usageCount}
                    </span>
                    <Link
                      href={buildAdminHref(resolvedSearchParams, {
                        modal: activeAddon === "banners" ? "banner-view" : "coupon-view",
                        id: addon.id,
                      })}
                      aria-label={`View ${addon.title}`}
                      className="rounded-lg border border-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80"
                    >
                      View
                    </Link>
                    <Link
                      href={buildAdminHref(resolvedSearchParams, {
                        modal: activeAddon === "banners" ? "banner-edit" : "coupon-edit",
                        id: addon.id,
                      })}
                      aria-label={`Edit ${addon.title}`}
                      className="rounded-lg border border-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80"
                    >
                      Edit
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

          <AdminPagination
            page={addonPage}
            total={addonsTotal}
            pageSize={addonPageSize}
            prevHref={buildAdminHref(resolvedSearchParams, { addonsPage: String(Math.max(1, addonPage - 1)) })}
            nextHref={buildAdminHref(resolvedSearchParams, { addonsPage: String(addonPage + 1) })}
          />
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <h2 className="text-xl font-semibold sm:text-2xl">Orders</h2>
          <p className="mt-1 text-sm text-primary/74">Operational orders stream with server-side pagination.</p>

          <div className="mt-4">
            <div className="mt-2 divide-y divide-primary/10 rounded-2xl border border-primary/12 bg-paper">
              {orderItems.length === 0 ? (
                <p className="p-3 text-sm text-primary/70">No orders found.</p>
              ) : (
                orderItems.map((order) => (
                  <article key={order.id} className="p-3.5">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary/60">{formatDate(order.createdAt)}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">{order.title}</p>
                        <p className="text-xs text-primary/72">{order.subtitle || order.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary/90">{order.amount > 0 ? formatPrice(order.amount) : "-"}</span>
                        <Link
                          href={buildAdminHref(resolvedSearchParams, { modal: "order-view", id: order.id })}
                          aria-label={`View order ${order.id}`}
                          className="rounded-lg border border-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <AdminPagination
              page={ordersPage}
              total={orderTotal}
              pageSize={transactionPageSize}
              prevHref={buildAdminHref(resolvedSearchParams, { ordersPage: String(Math.max(1, ordersPage - 1)) })}
              nextHref={buildAdminHref(resolvedSearchParams, { ordersPage: String(ordersPage + 1) })}
            />
          </div>
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <h2 className="text-xl font-semibold sm:text-2xl">Payments</h2>
          <p className="mt-1 text-sm text-primary/74">Payments stream with server-side pagination.</p>

          <div className="mt-4">
            <div className="mt-2 divide-y divide-primary/10 rounded-2xl border border-primary/12 bg-paper">
              {paymentItems.length === 0 ? (
                <p className="p-3 text-sm text-primary/70">No payments found.</p>
              ) : (
                paymentItems.map((payment) => (
                  <article key={payment.id} className="p-3.5">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary/60">{formatDate(payment.createdAt)}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-primary">{payment.title}</p>
                        <p className="text-xs text-primary/72">{payment.subtitle || payment.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-primary/90">{payment.amount > 0 ? formatPrice(payment.amount) : "-"}</span>
                        <Link
                          href={buildAdminHref(resolvedSearchParams, { modal: "payment-view", id: payment.id })}
                          aria-label={`View payment ${payment.id}`}
                          className="rounded-lg border border-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <AdminPagination
              page={paymentsPage}
              total={paymentTotal}
              pageSize={transactionPageSize}
              prevHref={buildAdminHref(resolvedSearchParams, { paymentsPage: String(Math.max(1, paymentsPage - 1)) })}
              nextHref={buildAdminHref(resolvedSearchParams, { paymentsPage: String(paymentsPage + 1) })}
            />
          </div>
        </section>
      ) : null}

      {modal === "product-view" && modalDocumentType === "product" && modalDocument ? (
        <AdminModal title="Product Details" backHref={baseWithoutModal}>
          <div className="space-y-2 text-sm">
            {Object.entries(modalDocument).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[7.2rem_1fr] gap-2 border-b border-primary/8 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/60">{key}</p>
                <p className="break-all text-primary/84">{serializeForDetail(value)}</p>
              </div>
            ))}
          </div>
        </AdminModal>
      ) : null}

      {(modal === "product-edit" || modal === "product-create") ? (
        <AdminModal title={modal === "product-create" ? "Create Product" : "Edit Product"} backHref={baseWithoutModal}>
          <form action={saveProductAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="productId" value={modal === "product-edit" ? String(modalDocument?.$id ?? entityId) : ""} />
            <input type="hidden" name="returnTo" value={baseWithoutModal} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Name</span>
              <input aria-label="Product name" name="name" defaultValue={String(modalDocument?.name ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">SKU</span>
              <input aria-label="Product SKU" name="sku" defaultValue={String(modalDocument?.sku ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Slug</span>
              <input aria-label="Product slug" name="slug" defaultValue={String(modalDocument?.slug ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Category</span>
              <input aria-label="Product category" name="category" defaultValue={String(modalDocument?.category ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Sub Category</span>
              <input aria-label="Product sub category" name="subCategory" defaultValue={String(modalDocument?.subCategory ?? modalDocument?.subcategory ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Main Image URL</span>
              <input aria-label="Main image URL" name="mainImageUrl" defaultValue={String(modalDocument?.mainImageUrl ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount Price</span>
              <input aria-label="Discount price" name="discountPrice" type="number" defaultValue={String(modalDocument?.discountPrice ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Original Price</span>
              <input aria-label="Original price" name="originalPrice" type="number" defaultValue={String(modalDocument?.originalPrice ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Stock Qty</span>
              <input aria-label="Stock quantity" name="stockQty" type="number" defaultValue={String(modalDocument?.stockQty ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">InStock (true/false)</span>
              <input aria-label="In stock value" name="inStock" defaultValue={String(modalDocument?.inStock ?? true)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Description</span>
              <textarea aria-label="Product description" name="description" rows={4} defaultValue={String(modalDocument?.description ?? "")} className="rounded-xl border border-primary/18 bg-paper px-3 py-2.5 text-sm" required />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Sizes (comma separated)</span>
              <input aria-label="Product sizes" name="sizeOptions" defaultValue={toStringArray(modalDocument?.sizeOptions).join(", ")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Colors (comma separated)</span>
              <input aria-label="Product colors" name="colorOptions" defaultValue={toStringArray(modalDocument?.colorOptions).join(", ")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Other Image URLs (comma separated)</span>
              <input aria-label="Other image URLs" name="otherImageUrls" defaultValue={toStringArray(modalDocument?.otherImageUrls).join(", ")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Active (true/false)</span>
              <input aria-label="Product active value" name="isActive" defaultValue={String(modalDocument?.isActive ?? true)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" aria-label="Save product" className="cta-thread">Save</button>
            </div>
          </form>
        </AdminModal>
      ) : null}

      {(modal === "banner-create" || modal === "banner-edit" || modal === "coupon-create" || modal === "coupon-edit") ? (
        <AdminModal
          title={modal.includes("create") ? "Create AddOn" : "Edit AddOn"}
          backHref={baseWithoutModal}
        >
          <form action={saveAddonAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="addonType" value={modal.startsWith("coupon") ? "coupons" : "banners"} />
            <input type="hidden" name="addonId" value={modal.includes("edit") ? String(modalDocument?.$id ?? entityId) : ""} />
            <input type="hidden" name="returnTo" value={baseWithoutModal} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Title</span>
              <input aria-label="Addon title" name="title" defaultValue={String(modalDocument?.title ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Usage Count</span>
              <input aria-label="Addon usage count" name="usageCount" type="number" defaultValue={String(modalDocument?.usageCount ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            {modal.startsWith("coupon") ? (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Code</span>
                  <input aria-label="Coupon code" name="code" defaultValue={String(modalDocument?.code ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount %</span>
                  <input aria-label="Coupon discount percent" name="discountPercent" type="number" defaultValue={String(modalDocument?.discountPercent ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Minimum Order</span>
                  <input aria-label="Coupon minimum order" name="minOrderValue" type="number" defaultValue={String(modalDocument?.minOrderValue ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Image URL</span>
                  <input aria-label="Banner image URL" name="imageUrl" defaultValue={String(modalDocument?.imageUrl ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">CTA Label</span>
                  <input aria-label="Banner CTA label" name="ctaLabel" defaultValue={String(modalDocument?.ctaLabel ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">CTA URL</span>
                  <input aria-label="Banner CTA URL" name="ctaUrl" defaultValue={String(modalDocument?.ctaUrl ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
                </label>
              </>
            )}
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Subtitle / Description</span>
              <textarea aria-label="Addon subtitle" name="subtitle" rows={3} defaultValue={String(modalDocument?.subtitle ?? "")} className="rounded-xl border border-primary/18 bg-paper px-3 py-2.5 text-sm" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Active (true/false)</span>
              <input aria-label="Addon active value" name="isActive" defaultValue={String(modalDocument?.isActive ?? true)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <div className="sm:col-span-2">
              <button type="submit" aria-label="Save addon" className="cta-thread">Save</button>
            </div>
          </form>
        </AdminModal>
      ) : null}

      {(modal === "banner-view" || modal === "coupon-view" || modal === "order-view" || modal === "payment-view") && modalDocument ? (
        <AdminModal title="Details" backHref={baseWithoutModal}>
          <div className="space-y-2 text-sm">
            {Object.entries(modalDocument).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[7.2rem_1fr] gap-2 border-b border-primary/8 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary/60">{key}</p>
                <p className="break-all text-primary/84">{serializeForDetail(value)}</p>
              </div>
            ))}
          </div>
        </AdminModal>
      ) : null}

      <AdminMobileBottomBar activeTab={activeTab} />
    </main>
  );
}
