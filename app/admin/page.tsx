import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ID, Query } from "node-appwrite";

import { AdminImageUploadField } from "@/app/components/admin-image-upload-field";
import { AdminModalClose } from "@/app/components/admin-modal-close";
import { AdminTransactionFilters } from "@/app/components/admin-transaction-filters";
import { AdminMultiSelectField } from "@/app/components/admin-multi-select-field";
import { AdminMobileBottomBar } from "@/app/components/admin-mobile-bottom-bar";
import { AdminSessionBootstrap } from "@/app/components/admin-session-bootstrap";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { createDatabasesWithApiKey, getDatabaseId } from "@/lib/appwrite/admin-server";
import { ensureSlug } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;
type AdminTab = "products" | "addons" | "orders" | "payments";
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

function withinDateRange(iso: string, from: string, to: string) {
  if (!from && !to) {
    return true;
  }

  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) {
    return true;
  }

  if (from) {
    const fromTime = new Date(`${from}T00:00:00`).getTime();
    if (Number.isFinite(fromTime) && time < fromTime) {
      return false;
    }
  }

  if (to) {
    const toTime = new Date(`${to}T23:59:59.999`).getTime();
    if (Number.isFinite(toTime) && time > toTime) {
      return false;
    }
  }

  return true;
}

function matchesTransactionQuery(document: Record<string, unknown>, query: string) {
  if (!query) {
    return true;
  }

  const haystack = [
    document.orderNumber,
    document.userEmail,
    document.$id,
    document.orderId,
    document.providerPaymentId,
    document.status,
    document.paymentStatus,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");

  return haystack.includes(query);
}

const PRODUCT_COLOR_PALETTE = [
  "Black",
  "White",
  "Red",
  "Maroon",
  "Pink",
  "Blue",
  "Navy",
  "Green",
  "Yellow",
  "Beige",
  "Brown",
  "Grey",
  "Orange",
  "Purple",
  "Gold",
  "Silver",
];

async function getProductFormOptions() {
  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();

  const [collection, documents] = await Promise.all([
    databases.getCollection(databaseId, "sku"),
    databases
      .listDocuments(databaseId, "sku", [Query.limit(200), Query.orderDesc("$createdAt")])
      .catch(() => ({ documents: [] as Record<string, unknown>[] })),
  ]);

  const enumOf = (key: string) => {
    const attribute = collection.attributes.find((item) => (item as { key?: string }).key === key) as
      | { elements?: unknown }
      | undefined;
    return Array.isArray(attribute?.elements)
      ? (attribute?.elements.filter((value): value is string => typeof value === "string") ?? [])
      : [];
  };

  const colors = new Set<string>(PRODUCT_COLOR_PALETTE);
  for (const document of documents.documents as Record<string, unknown>[]) {
    const docColors = Array.isArray(document.colorOptions) ? document.colorOptions : [];
    for (const color of docColors) {
      const value = String(color ?? "").trim();
      if (value) {
        colors.add(value);
      }
    }
  }

  return {
    categories: enumOf("category"),
    subcategories: enumOf("subcategory"),
    sizes: enumOf("size"),
    colors: Array.from(colors).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
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

function getActiveTab(value: string): AdminTab {
  if (value === "products" || value === "addons" || value === "orders" || value === "payments") {
    return value;
  }

  return "products";
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
  // sku/slug are required by Appwrite on every updateDocument; fall back to productId if null in the row.
  const existingDoc = await databases.getDocument(getDatabaseId(), "sku", productId).catch(() => null);
  const existingSku = String(existingDoc?.sku ?? "").trim() || productId;
  const existingSlug = String(existingDoc?.slug ?? "").trim() || productId;
  await databases.updateDocument(getDatabaseId(), "sku", productId, {
    sku: existingSku,
    slug: existingSlug,
    inStock: nextInStock,
    stockQty: nextStockQty,
  });

  redirect(returnTo);
}

async function assertAdminSession() {
  const cookieStore = await cookies();
  if (!cookieStore.get("nt_admin_session")?.value) {
    throw new Error("Unauthorized: admin session required.");
  }
}

const SIZE_ENUM = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

function generateSkuCode(name: string) {
  const base = ensureSlug(name).replace(/-/g, "").toUpperCase().slice(0, 10) || "NT";
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${base}-${suffix}`.slice(0, 100);
}

async function generateUniqueSlug(
  databases: ReturnType<typeof createDatabasesWithApiKey>,
  databaseId: string,
  name: string
) {
  const base = ensureSlug(name, "product");
  try {
    const existing = await databases.listDocuments(databaseId, "sku", [Query.equal("slug", base), Query.limit(1)]);
    if (existing.documents.length === 0) {
      return base;
    }
  } catch {
    // Fall through to a suffixed slug if the lookup fails.
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 140);
}

async function saveProductAction(formData: FormData) {
  "use server";

  await assertAdminSession();

  const productId = String(formData.get("productId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin").trim() || "/admin";

  const name = String(formData.get("name") ?? "").trim();
  const stockQty = toNumber(formData.get("stockQty"));
  const sizeOptions = parseCommaSeparated(String(formData.get("sizeOptions") ?? ""));
  const primarySize = sizeOptions.find((value) => SIZE_ENUM.includes(value)) ?? "M";

  // Common fields written on both create and edit. Keys match the live `sku`
  // schema exactly (note: `subcategory` is lowercase; `inStock` is derived from
  // stock; `size` is a required single enum; `isActive` defaults to true).
  const payload: Record<string, unknown> = {
    name,
    description: String(formData.get("description") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    subcategory: String(formData.get("subcategory") ?? "").trim(),
    mainImageUrl: String(formData.get("mainImageUrl") ?? "").trim(),
    discountPrice: toNumber(formData.get("discountPrice")),
    originalPrice: toNumber(formData.get("originalPrice")),
    stockQty,
    inStock: stockQty > 0,
    size: primarySize,
    sizeOptions,
    colorOptions: parseCommaSeparated(String(formData.get("colorOptions") ?? "")),
    otherImageUrls: parseCommaSeparated(String(formData.get("otherImageUrls") ?? "")),
    isActive: true,
  };

  const databases = createDatabasesWithApiKey();
  const databaseId = getDatabaseId();

  if (productId) {
    // Include sku/slug in the payload so required fields are satisfied (TablesDB enforces required on every write).
    const existingSku = String(formData.get("existingSku") ?? "").trim();
    const existingSlug = String(formData.get("existingSlug") ?? "").trim();
    // Fall back to productId/generated slug if the row had null values (pre-existing rows before schema update).
    payload.sku = existingSku || productId;
    payload.slug = existingSlug || await generateUniqueSlug(databases, databaseId, name);
    await databases.updateDocument(databaseId, "sku", productId, payload);
  } else {
    const slug = await generateUniqueSlug(databases, databaseId, name);
    await databases.createDocument(databaseId, "sku", ID.unique(), {
      ...payload,
      sku: generateSkuCode(name),
      slug,
    });
  }

  redirect(returnTo);
}

async function saveAddonAction(formData: FormData) {
  "use server";

  await assertAdminSession();

  const addonType = String(formData.get("addonType") ?? "").trim().toLowerCase() === "coupons" ? "coupons" : "banners";
  const addonId = String(formData.get("addonId") ?? "").trim();
  const returnTo = String(formData.get("returnTo") ?? "/admin").trim() || "/admin";

  const collectionIds = addonType === "banners" ? ["banners", "banner"] : ["coupons", "coupon"];
  const candidate = await listDocumentsFromCandidates(collectionIds, [Query.limit(1)]);
  const collectionId = candidate.collectionId ?? collectionIds[0];

  const isActive = String(formData.get("isActive") ?? "true").trim().toLowerCase() !== "false";

  const payload: Record<string, unknown> = addonType === "banners"
    ? {
        title: String(formData.get("title") ?? "").trim(),
        // imageUrl and position are required in the DB schema. On create we use
        // empty string / 0; on edit the hidden field preserves the existing value.
        imageUrl: String(formData.get("imageUrl") ?? "").trim(),
        position: toNumber(formData.get("position")),
        isActive,
      }
    : {
        code: String(formData.get("code") ?? "").trim().toUpperCase(),
        discountType: String(formData.get("discountType") ?? "percentage").trim().toLowerCase(),
        discountValue: toNumber(formData.get("discountValue")),
        minOrderValue: toNumber(formData.get("minOrderValue")),
        maxDiscount: toNumber(formData.get("maxDiscount")),
        usageLimit: toNumber(formData.get("usageLimit")) || null,
        isActive,
      };

  const databases = createDatabasesWithApiKey();
  if (addonId) {
    await databases.updateDocument(getDatabaseId(), collectionId, addonId, payload);
  } else {
    await databases.createDocument(getDatabaseId(), collectionId, ID.unique(), payload);
  }

  redirect(returnTo);
}

const ORDER_FLOW = ["placed", "confirmed", "shipped", "out_for_delivery", "delivered", "completed"] as const;
const ORDER_STATUS_TERMINAL = ["delivered", "completed", "cancelled", "refunded_to_wallet"];
const ORDER_STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirm",
  shipped: "Mark shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Mark delivered",
  completed: "Mark completed",
  cancelled: "Cancel order",
};

function nextOrderStatusOptions(current: string) {
  const normalized = current.trim().toLowerCase();
  const index = ORDER_FLOW.indexOf(normalized as (typeof ORDER_FLOW)[number]);
  const forward = index >= 0 ? ORDER_FLOW.slice(index + 1) : [];
  const options: string[] = [...forward];
  if (!ORDER_STATUS_TERMINAL.includes(normalized)) {
    options.push("cancelled");
  }
  return options;
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
  maxWidth = "max-w-lg",
}: {
  title: string;
  backHref: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-primary/50 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-3xl border border-primary/15 bg-secondary p-5 shadow-[0_24px_48px_rgba(40,0,0,0.28)]`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          <AdminModalClose href={backHref} />
        </div>
        {children}
      </div>
    </div>
  );
}

function getDateRangeFromPeriod(period: string): { from: string; to: string } | null {
  if (!period) {
    return null;
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (period === "today") {
    const s = isoDate(now);
    return { from: s, to: s };
  }

  if (period === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    const s = isoDate(d);
    return { from: s, to: s };
  }

  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { from: isoDate(d), to: isoDate(now) };
  }

  if (period === "month") {
    const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    return { from, to: isoDate(now) };
  }

  const yearNum = Number(period);
  if (Number.isFinite(yearNum) && yearNum > 2000) {
    const isCurrentYear = yearNum === now.getFullYear();
    return {
      from: `${yearNum}-01-01`,
      to: isCurrentYear ? isoDate(now) : `${yearNum}-12-31`,
    };
  }

  return null;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const activeTab = getActiveTab(getFirstParam(resolvedSearchParams, "tab", "products"));
  const activeAddon = getActiveAddon(getFirstParam(resolvedSearchParams, "addon", "banners"));
  const productPage = getPositiveInt(resolvedSearchParams, "page", 1);
  const productQuery = getFirstParam(resolvedSearchParams, "q").trim().toLowerCase();
  const txnQuery = getFirstParam(resolvedSearchParams, "q").trim().toLowerCase();
  const txnPeriod = getFirstParam(resolvedSearchParams, "period").trim();
  const periodRange = getDateRangeFromPeriod(txnPeriod);
  const dateFrom = periodRange?.from ?? "";
  const dateTo = periodRange?.to ?? "";
  const modal = getFirstParam(resolvedSearchParams, "modal");
  const entityId = getFirstParam(resolvedSearchParams, "id");
  const refundStatus = getFirstParam(resolvedSearchParams, "refund");
  const orderStatusUpdate = getFirstParam(resolvedSearchParams, "orderStatus");
  const productPageSize = 12;

  const cookieStore = await cookies();
  const hasAdminSession = Boolean(cookieStore.get("nt_admin_session")?.value);

  if (!hasAdminSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-16 pb-24 text-primary md:pb-16 md:pt-20">
        <AdminSessionBootstrap />
      </main>
    );
  }

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
  if (activeTab === "addons") {
    const addonCollections = activeAddon === "banners" ? ["banners", "banner"] : ["coupons", "coupon"];
    const result = await listDocumentsFromCandidates(addonCollections, [
      Query.limit(100),
      Query.orderDesc("$createdAt"),
    ]);
    addons = result.documents.map((document) => mapAddon(document));
  }

  let orderItems: AdminTransaction[] = [];
  let paymentItems: AdminTransaction[] = [];
  let paymentStatusSummary = {
    paid: 0,
    failed: 0,
    created: 0,
    refundedToWallet: 0,
  };

  if (activeTab === "orders") {
    const ordersResult = await listDocumentsFromCandidates(["orders"], [
      Query.limit(100),
      Query.orderDesc("$createdAt"),
    ]);

    orderItems = ordersResult.documents
      .filter(
        (document) =>
          matchesTransactionQuery(document, txnQuery) &&
          withinDateRange(String(document.$createdAt ?? document.placedAt ?? ""), dateFrom, dateTo)
      )
      .map((document) => mapTransaction(document, "Order"));
  }

  if (activeTab === "payments") {
    const [paymentsResult, paidCount, failedCount, createdCount, refundedToWalletCount] = await Promise.all([
      listDocumentsFromCandidates(["payments"], [Query.limit(100), Query.orderDesc("$createdAt")]),
      listDocumentsFromCandidates(["payments"], [Query.equal("status", "paid"), Query.limit(1)]).then((result) => result.total).catch(() => 0),
      listDocumentsFromCandidates(["payments"], [Query.equal("status", "failed"), Query.limit(1)]).then((result) => result.total).catch(() => 0),
      listDocumentsFromCandidates(["payments"], [Query.equal("status", "created"), Query.limit(1)]).then((result) => result.total).catch(() => 0),
      listDocumentsFromCandidates(["payments"], [Query.equal("status", "refunded_to_wallet"), Query.limit(1)]).then((result) => result.total).catch(() => 0),
    ]);

    paymentItems = paymentsResult.documents
      .filter(
        (document) =>
          matchesTransactionQuery(document, txnQuery) &&
          withinDateRange(String(document.$createdAt ?? document.paidAt ?? ""), dateFrom, dateTo)
      )
      .map((document) => mapTransaction(document, "Payment"));
    paymentStatusSummary = {
      paid: paidCount,
      failed: failedCount,
      created: createdCount,
      refundedToWallet: refundedToWalletCount,
    };
  }

  const productFormOptions =
    modal === "product-create" || modal === "product-edit" ? await getProductFormOptions() : null;

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
      {refundStatus ? (
        <section className="mx-auto mb-3 w-full max-w-7xl rounded-2xl border border-primary/16 bg-secondary px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/62">Refund Update</p>
          <p className="mt-1 text-sm text-primary/84">
            {refundStatus === "success"
              ? "Refund credited to user wallet successfully."
              : refundStatus === "duplicate"
                ? "Refund already credited to wallet for this order."
                : refundStatus === "not-paid"
                  ? "Only paid orders can be refunded to wallet."
                  : refundStatus === "invalid-order"
                    ? "Order data is invalid for wallet refund."
                    : refundStatus === "missing-order"
                      ? "Order was not provided for refund action."
                      : "Refund action failed. Please retry."}
          </p>
        </section>
      ) : null}

      {orderStatusUpdate ? (
        <section className="mx-auto mb-3 w-full max-w-7xl rounded-2xl border border-primary/16 bg-secondary px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/62">Order Status</p>
          <p className="mt-1 text-sm text-primary/84">
            {orderStatusUpdate === "success"
              ? "Order status updated and customer notified."
              : orderStatusUpdate === "invalid"
                ? "That status change is not allowed from the current state."
                : orderStatusUpdate === "missing"
                  ? "Order or status was missing for the update."
                  : "Could not update order status. Please retry."}
          </p>
        </section>
      ) : null}

      <section className="mx-auto hidden w-full max-w-7xl md:block">
        <nav aria-label="Admin sections" className="grid grid-cols-4 gap-2">
          {[
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
            <div className="grid grid-cols-2 gap-3 md:gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => {
                const price = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
                const imageSrc = product.mainImageUrl || product.otherImageUrls[0] || "/logo4.png";
                const isInStock = product.inStock;

                return (
                  <article key={product.id} className="rounded-2xl border border-primary/12 bg-[#fbf5e6] p-2.5 hover:shadow-lg transition ">
                    <div className="relative mb-2.5 overflow-hidden rounded-xl border border-primary/10 bg-paper/60">
                      <div className="relative aspect-[4/3] w-full">
                        <CloudinaryImage
                          src={imageSrc}
                          alt={product.name}
                          fill
                          sizes="(max-width: 640px) 40vw, 220px"
                          className="object-cover md:object-contain"
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
              <p className="mt-1 text-sm text-primary/72">Manage banners and coupons.</p>
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
            <div className="max-h-[70vh] divide-y divide-primary/10 overflow-y-auto rounded-2xl border border-primary/12 bg-paper">
              {addons.map((addon) => (
                <article key={addon.id} className="relative p-3.5 pr-[5.5rem]">
                  {/* Edit button pinned top-right */}
                  <Link
                    href={buildAdminHref(resolvedSearchParams, {
                      modal: activeAddon === "banners" ? "banner-edit" : "coupon-edit",
                      id: addon.id,
                    })}
                    aria-label={`Edit ${activeAddon === "coupons" ? addon.code || addon.title : addon.title}`}
                    className="absolute right-3 top-3 rounded-lg border border-primary/20 bg-paper px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80 transition hover:border-primary/40"
                  >
                    Edit
                  </Link>
                  <p className="text-sm font-semibold text-primary">
                    {activeAddon === "coupons" ? addon.code || addon.title : addon.title}
                  </p>
                  {activeAddon === "coupons" ? (
                    <p className="mt-0.5 text-xs text-primary/65">{addon.subtitle || "—"}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {activeAddon === "coupons" ? (
                      <span className="rounded-full border border-primary/16 bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/70">
                        {addon.usageCount} used
                      </span>
                    ) : null}
                    <span className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${
                      addon.isActive !== false
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-500"
                    }`}>
                      {addon.isActive !== false ? "Active" : "Inactive"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <h2 className="text-xl font-semibold sm:text-2xl">Orders</h2>
          <p className="mt-1 text-sm text-primary/74">Operational orders stream with wallet-first refund actions.</p>

          <AdminTransactionFilters tab="orders" q={txnQuery} period={txnPeriod} />

          <div className="mt-4">
            <div className="mt-2 max-h-[68vh] divide-y divide-primary/10 overflow-y-auto rounded-2xl border border-primary/12 bg-paper">
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
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="text-sm font-semibold text-primary/90">{order.amount > 0 ? formatPrice(order.amount) : "-"}</span>
                        {String(order.raw.paymentStatus ?? "").toLowerCase() === "paid" &&
                        String(order.raw.status ?? "").toLowerCase() !== "refunded_to_wallet" ? (
                          <form action="/api/admin/orders/refund-to-wallet" method="POST">
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="reason" value="Admin approved wallet refund" />
                            <input type="hidden" name="returnTo" value={buildAdminHref(resolvedSearchParams, {})} />
                            <button
                              type="submit"
                              aria-label={`Refund order ${order.id} to wallet`}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-700"
                            >
                              Refund to Wallet
                            </button>
                          </form>
                        ) : null}
                        <Link
                          href={buildAdminHref(resolvedSearchParams, { modal: "order-view", id: order.id })}
                          aria-label={`View order ${order.id}`}
                          className="rounded-lg border border-primary/20 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80"
                        >
                          View
                        </Link>
                      </div>
                    </div>

                    {(() => {
                      const currentStatus = String(order.raw.status ?? "").toLowerCase();
                      const options = nextOrderStatusOptions(currentStatus);
                      if (options.length === 0) {
                        return null;
                      }
                      return (
                        <form
                          action="/api/admin/orders/status"
                          method="POST"
                          className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-primary/10 pt-2.5"
                        >
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="returnTo" value={buildAdminHref(resolvedSearchParams, {})} />
                          <span className="rounded-md bg-secondary px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-primary/70">
                            {currentStatus.replace(/_/g, " ") || "—"}
                          </span>
                          <select
                            name="status"
                            aria-label={`Update status for order ${order.id}`}
                            defaultValue={options[0]}
                            className="h-9 rounded-lg border border-primary/20 bg-paper px-2 text-xs text-primary"
                          >
                            {options.map((option) => (
                              <option key={option} value={option}>
                                {ORDER_STATUS_LABELS[option] ?? option}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            aria-label={`Apply status change to order ${order.id}`}
                            className="rounded-lg border border-primary/25 bg-primary px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-paper"
                          >
                            Update
                          </button>
                        </form>
                      );
                    })()}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "payments" ? (
        <section className="mx-auto mt-4 w-full max-w-7xl sm:mt-5">
          <h2 className="text-xl font-semibold sm:text-2xl">Payments</h2>
          <p className="mt-1 text-sm text-primary/74">Payments stream with reconciliation status and refund tracking.</p>

          <AdminTransactionFilters tab="payments" q={txnQuery} period={txnPeriod} />

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <article className="rounded-xl border border-primary/12 bg-secondary p-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">Paid</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{paymentStatusSummary.paid}</p>
            </article>
            <article className="rounded-xl border border-primary/12 bg-secondary p-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">Failed</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{paymentStatusSummary.failed}</p>
            </article>
            <article className="rounded-xl border border-primary/12 bg-secondary p-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{paymentStatusSummary.created}</p>
            </article>
            <article className="rounded-xl border border-primary/12 bg-secondary p-3">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">Refunded To Wallet</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{paymentStatusSummary.refundedToWallet}</p>
            </article>
          </div>

          <div className="mt-4">
            <div className="mt-2 max-h-[60vh] divide-y divide-primary/10 overflow-y-auto rounded-2xl border border-primary/12 bg-paper">
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
          </div>
        </section>
      ) : null}

      {modal === "product-view" && modalDocumentType === "product" && modalDocument ? (
        <AdminModal title="Product Details" backHref={baseWithoutModal} maxWidth="max-w-lg">
          {(() => {
            const p = mapProduct(modalDocument);
            return (
              <div className="space-y-4 text-sm">
                {p.mainImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.mainImageUrl} alt={p.name} className="h-48 w-full rounded-xl object-cover border border-primary/10" />
                ) : null}
                <div>
                  <p className="text-base font-semibold text-primary">{p.name}</p>
                  <p className="mt-0.5 text-xs text-primary/60">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ""}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/55">Price</p>
                    <p className="mt-1 font-semibold text-primary">{formatPrice(p.discountPrice || p.originalPrice)}</p>
                    {p.discountPrice > 0 && p.originalPrice > p.discountPrice ? (
                      <p className="mt-0.5 text-xs text-primary/55 line-through">{formatPrice(p.originalPrice)}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/55">Stock</p>
                    <p className="mt-1 font-semibold text-primary">{p.stockQty}</p>
                    <p className={`mt-0.5 text-xs ${p.inStock ? "text-green-600" : "text-red-500"}`}>{p.inStock ? "In stock" : "Out of stock"}</p>
                  </div>
                </div>
                {p.sizeOptions.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/55">Sizes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.sizeOptions.map((s) => <span key={s} className="rounded-full border border-primary/20 bg-paper px-2.5 py-1 text-xs">{s}</span>)}
                    </div>
                  </div>
                ) : null}
                {p.colorOptions.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/55">Colors</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.colorOptions.map((c) => <span key={c} className="rounded-full border border-primary/20 bg-paper px-2.5 py-1 text-xs">{c}</span>)}
                    </div>
                  </div>
                ) : null}
                {p.description ? (
                  <div>
                    <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-primary/55">Description</p>
                    <p className="text-primary/80 leading-relaxed">{p.description}</p>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </AdminModal>
      ) : null}

      {(modal === "product-edit" || modal === "product-create") ? (
        <AdminModal title={modal === "product-create" ? "Create Product" : "Edit Product"} backHref={baseWithoutModal} maxWidth="max-w-2xl">
          <form action={saveProductAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input type="hidden" name="productId" value={modal === "product-edit" ? String(modalDocument?.$id ?? entityId) : ""} />
            <input type="hidden" name="returnTo" value={baseWithoutModal} />
            {modal === "product-edit" && <input type="hidden" name="existingSku" value={String(modalDocument?.sku ?? "")} />}
            {modal === "product-edit" && <input type="hidden" name="existingSlug" value={String(modalDocument?.slug ?? "")} />}
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Name</span>
              <input aria-label="Product name" name="name" defaultValue={String(modalDocument?.name ?? "")} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Category</span>
              <select
                aria-label="Product category"
                name="category"
                defaultValue={String(modalDocument?.category ?? "")}
                className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm"
                required
              >
                <option value="" disabled>
                  Select category
                </option>
                {(productFormOptions?.categories ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Sub Category</span>
              <select
                aria-label="Product sub category"
                name="subcategory"
                defaultValue={String(modalDocument?.subcategory ?? modalDocument?.subCategory ?? "")}
                className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm"
                required
              >
                <option value="" disabled>
                  Select sub category
                </option>
                {(productFormOptions?.subcategories ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Original Price</span>
              <input aria-label="Original price" name="originalPrice" type="number" min="0" defaultValue={String(modalDocument?.originalPrice ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount Price</span>
              <input aria-label="Discount price" name="discountPrice" type="number" min="0" defaultValue={String(modalDocument?.discountPrice ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" />
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Stock Qty</span>
              <input aria-label="Stock quantity" name="stockQty" type="number" min="0" defaultValue={String(modalDocument?.stockQty ?? 0)} className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm" required />
              <span className="text-[0.62rem] text-primary/55">In-stock is set automatically when quantity is above 0.</span>
            </label>
            <label className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Description</span>
              <textarea aria-label="Product description" name="description" rows={4} defaultValue={String(modalDocument?.description ?? "")} className="rounded-xl border border-primary/18 bg-paper px-3 py-2.5 text-sm" required />
            </label>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Sizes</span>
              <AdminMultiSelectField
                name="sizeOptions"
                label="Size"
                options={productFormOptions?.sizes ?? []}
                defaultValue={toStringArray(modalDocument?.sizeOptions).join(", ")}
                inline
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Colors</span>
              <AdminMultiSelectField
                name="colorOptions"
                label="Color"
                options={productFormOptions?.colors ?? []}
                defaultValue={toStringArray(modalDocument?.colorOptions).join(", ")}
                allowCustom
              />
              {/* inline not set → uses dropdown for the long color list */}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Main Image</span>
              <AdminImageUploadField name="mainImageUrl" label="Main image" defaultValue={String(modalDocument?.mainImageUrl ?? "")} required />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Other Images</span>
              <AdminImageUploadField name="otherImageUrls" label="Other images" multiple defaultValue={toStringArray(modalDocument?.otherImageUrls).join(", ")} />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" aria-label="Save product" className="cta-thread">Save</button>
            </div>
          </form>
        </AdminModal>
      ) : null}

      {(modal === "banner-create" || modal === "banner-edit" || modal === "coupon-create" || modal === "coupon-edit") ? (
        <AdminModal
          title={modal.startsWith("banner") ? (modal.includes("create") ? "New Banner" : "Edit Banner") : (modal.includes("create") ? "New Coupon" : "Edit Coupon")}
          backHref={baseWithoutModal}
          maxWidth="max-w-lg"
        >
          {modal.startsWith("banner") ? (
            /* ── BANNER FORM ── title + active only ── */
            <form action={saveAddonAction} className="flex flex-col gap-3">
              <input type="hidden" name="addonType" value="banners" />
              <input type="hidden" name="addonId" value={modal === "banner-edit" ? String(modalDocument?.$id ?? entityId) : ""} />
              <input type="hidden" name="returnTo" value={baseWithoutModal} />
              {/* Preserve required DB fields silently on edit */}
              <input type="hidden" name="imageUrl" value={String(modalDocument?.imageUrl ?? "")} />
              <input type="hidden" name="position" value={String(toNumber(modalDocument?.position))} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Banner Text</span>
                <input
                  aria-label="Banner text"
                  name="title"
                  defaultValue={String(modalDocument?.title ?? "")}
                  placeholder="e.g. Free shipping on orders above ₹1,499"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Status</span>
                <select
                  aria-label="Banner active status"
                  name="isActive"
                  defaultValue={String(toBoolean(modalDocument?.isActive, true))}
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="true">Active — visible to customers</option>
                  <option value="false">Inactive — hidden</option>
                </select>
              </label>
              <button type="submit" aria-label="Save banner" className="cta-thread mt-1">Save Banner</button>
            </form>
          ) : (
            /* ── COUPON FORM ── code / discount / limits / active ── */
            <form action={saveAddonAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input type="hidden" name="addonType" value="coupons" />
              <input type="hidden" name="addonId" value={modal === "coupon-edit" ? String(modalDocument?.$id ?? entityId) : ""} />
              <input type="hidden" name="returnTo" value={baseWithoutModal} />
              <label className="sm:col-span-2 flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Coupon Code</span>
                <input
                  aria-label="Coupon code"
                  name="code"
                  defaultValue={String(modalDocument?.code ?? "")}
                  placeholder="e.g. NAARI20"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm uppercase tracking-wider outline-none focus:border-primary"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount Type</span>
                <select
                  aria-label="Discount type"
                  name="discountType"
                  defaultValue={String(modalDocument?.discountType ?? "percentage")}
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                  required
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Discount Value</span>
                <input
                  aria-label="Discount value"
                  name="discountValue"
                  type="number"
                  min="0"
                  defaultValue={String(toNumber(modalDocument?.discountValue ?? modalDocument?.discountPercent))}
                  placeholder="e.g. 20 for 20% off"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                  required
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Min Order (₹)</span>
                <input
                  aria-label="Minimum order value"
                  name="minOrderValue"
                  type="number"
                  min="0"
                  defaultValue={String(toNumber(modalDocument?.minOrderValue))}
                  placeholder="0 = no minimum"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Max Discount Cap (₹)</span>
                <input
                  aria-label="Max discount amount"
                  name="maxDiscount"
                  type="number"
                  min="0"
                  defaultValue={String(toNumber(modalDocument?.maxDiscount))}
                  placeholder="0 = no cap"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Usage Limit</span>
                <input
                  aria-label="Usage limit"
                  name="usageLimit"
                  type="number"
                  min="0"
                  defaultValue={String(toNumber(modalDocument?.usageLimit))}
                  placeholder="0 = unlimited"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-primary/62">Status</span>
                <select
                  aria-label="Coupon active status"
                  name="isActive"
                  defaultValue={String(toBoolean(modalDocument?.isActive, true))}
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="true">Active — can be redeemed</option>
                  <option value="false">Inactive — disabled</option>
                </select>
              </label>
              <div className="sm:col-span-2">
                <button type="submit" aria-label="Save coupon" className="cta-thread">Save Coupon</button>
              </div>
            </form>
          )}
        </AdminModal>
      ) : null}

      {/* ─── Order View Modal ─── */}
      {modal === "order-view" && modalDocument ? (
        <AdminModal title="Order Details" backHref={baseWithoutModal} maxWidth="max-w-xl">
          {(() => {
            const doc = modalDocument;
            const statusColor: Record<string, string> = {
              placed: "text-green-700 bg-green-50 border-green-200",
              confirmed: "text-blue-700 bg-blue-50 border-blue-200",
              shipped: "text-indigo-700 bg-indigo-50 border-indigo-200",
              out_for_delivery: "text-purple-700 bg-purple-50 border-purple-200",
              delivered: "text-emerald-700 bg-emerald-50 border-emerald-200",
              completed: "text-emerald-700 bg-emerald-50 border-emerald-200",
              payment_failed: "text-red-700 bg-red-50 border-red-200",
              cancelled: "text-zinc-700 bg-zinc-50 border-zinc-200",
              refunded_to_wallet: "text-amber-700 bg-amber-50 border-amber-200",
            };
            const status = String(doc.status ?? "").toLowerCase();
            const payStatus = String(doc.paymentStatus ?? "").toLowerCase();

            let items: Array<{productId: string; productName: string; quantity: number; size?: string; color?: string; unitAmount: number}> = [];
            try { items = JSON.parse(String(doc.itemsJson ?? "[]")); } catch { items = []; }

            let address: Record<string, unknown> = {};
            try { address = JSON.parse(String(doc.shippingAddress ?? "{}")); } catch { address = {}; }

            return (
              <div className="space-y-4 text-sm">
                {/* Header row */}
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-primary">{String(doc.orderNumber ?? doc.$id ?? "—")}</p>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${statusColor[status] ?? "text-primary/70 bg-secondary border-primary/20"}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${statusColor[payStatus] ?? "text-primary/70 bg-secondary border-primary/20"}`}>
                    {payStatus.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Placed at + amount */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">Placed</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{formatDate(String(doc.placedAt ?? doc.$createdAt ?? ""))}</p>
                  </div>
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">Total</p>
                    <p className="mt-1 text-sm font-semibold text-primary">{formatPrice(toNumber(doc.totalAmount))}</p>
                  </div>
                </div>

                {/* Customer */}
                <div className="rounded-xl border border-primary/12 bg-paper p-3">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">Customer</p>
                  <p className="mt-1 font-semibold text-primary">{String(doc.userEmail ?? "—")}</p>
                  {address.fullName ? <p className="mt-0.5 text-primary/75">{String(address.fullName)}</p> : null}
                  {address.phone ? <p className="mt-0.5 text-primary/75">{String(address.phone)}</p> : null}
                </div>

                {/* Shipping address */}
                {address.line1 ? (
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">Ship to</p>
                    <p className="mt-1 text-primary/84 leading-relaxed">
                      {[address.line1, address.city, address.state, address.postalCode, address.country].filter(Boolean).join(", ")}
                    </p>
                  </div>
                ) : null}

                {/* Items */}
                {items.length > 0 ? (
                  <div className="rounded-xl border border-primary/12 bg-paper p-3">
                    <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-primary/55">Items ({items.length})</p>
                    <div className="space-y-2">
                      {items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 border-t border-primary/8 pt-2 first:border-0 first:pt-0">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-primary">{item.productName || item.productId}</p>
                            <p className="text-xs text-primary/60">{[item.size, item.color].filter(Boolean).join(" · ")} · Qty {item.quantity}</p>
                          </div>
                          <p className="shrink-0 font-semibold text-primary/90">{formatPrice(item.unitAmount * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Pricing breakdown */}
                <div className="rounded-xl border border-primary/12 bg-paper p-3">
                  <div className="space-y-1.5">
                    {toNumber(doc.discountAmount) > 0 ? (
                      <div className="flex justify-between text-xs text-primary/75">
                        <span>Discount</span>
                        <span className="text-green-700">−{formatPrice(toNumber(doc.discountAmount))}</span>
                      </div>
                    ) : null}
                    {toNumber(doc.shippingAmount) > 0 ? (
                      <div className="flex justify-between text-xs text-primary/75">
                        <span>Delivery</span>
                        <span>{formatPrice(toNumber(doc.shippingAmount))}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between border-t border-primary/10 pt-1.5 font-semibold text-primary">
                      <span>Total</span>
                      <span>{formatPrice(toNumber(doc.totalAmount))}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </AdminModal>
      ) : null}

      {/* ─── Payment View Modal ─── */}
      {modal === "payment-view" && modalDocument ? (
        <AdminModal title="Payment Details" backHref={baseWithoutModal} maxWidth="max-w-md">
          {(() => {
            const doc = modalDocument;
            const status = String(doc.status ?? "").toLowerCase();
            const statusColor: Record<string, string> = {
              paid: "text-green-700 bg-green-50 border-green-200",
              captured: "text-green-700 bg-green-50 border-green-200",
              failed: "text-red-700 bg-red-50 border-red-200",
              refunded_to_wallet: "text-amber-700 bg-amber-50 border-amber-200",
              created: "text-zinc-600 bg-zinc-50 border-zinc-200",
              authorized: "text-blue-700 bg-blue-50 border-blue-200",
            };

            let meta: Record<string, unknown> = {};
            try { meta = JSON.parse(String(doc.paymentMeta ?? "{}")); } catch { meta = {}; }

            return (
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em] ${statusColor[status] ?? "text-primary/70 bg-secondary border-primary/20"}`}>
                    {status.replace(/_/g, " ")}
                  </span>
                  <p className="font-semibold text-primary">{formatPrice(toNumber(doc.amount))}</p>
                  <p className="text-xs text-primary/60">{String(doc.currency ?? "INR")}</p>
                </div>

                <div className="rounded-xl border border-primary/12 bg-paper divide-y divide-primary/8">
                  {[
                    ["Order ID", doc.orderId],
                    ["Provider", doc.provider],
                    ["Razorpay Payment ID", meta.razorpayPaymentId || doc.providerPaymentId],
                    ["Razorpay Order ID", meta.razorpayOrderId],
                    ["Method", meta.method],
                    ["Bank / Wallet", meta.bank || meta.wallet],
                    ["Customer", meta.email || doc.userEmail],
                    ["Contact", meta.contact],
                    ["Paid at", doc.paidAt ? formatDate(String(doc.paidAt)) : "—"],
                    ["Created", formatDate(String(doc.$createdAt ?? ""))],
                  ]
                    .filter(([, v]) => v && String(v).trim() && String(v) !== "undefined")
                    .map(([label, value]) => (
                      <div key={String(label)} className="flex items-start justify-between gap-3 px-3 py-2.5">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-primary/55 shrink-0">{String(label)}</p>
                        <p className="break-all text-right text-sm text-primary/84">{String(value)}</p>
                      </div>
                    ))}
                </div>
              </div>
            );
          })()}
        </AdminModal>
      ) : null}

      <AdminMobileBottomBar activeTab={activeTab} />
    </main>
  );
}
