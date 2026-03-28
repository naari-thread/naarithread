import { Client, Databases, Query } from "node-appwrite";
import { normalizeProductCategory, type ProductCategorySlug, type ProductSubCategorySlug } from "@/lib/product-taxonomy";
import { ensureSlug, toSlug } from "@/lib/slug";

export type ProductRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sku: string;
  category: ProductCategorySlug;
  subCategory: ProductSubCategorySlug;
  categoryValue: string;
  subCategoryValue: string;
  mainImageUrl: string;
  otherImageUrls: string[];
  discountPrice: number;
  originalPrice: number;
  stockQty: number;
  rating: number;
  ratingCount: number;
  colorOptions: string[];
  sizeOptions: string[];
  isActive: boolean;
  createdAt: string;
};

let resolvedDatabaseIdCache: string | null = null;
const SKU_COLLECTION_ID = "sku";

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toProductRecord(document: Record<string, unknown>): ProductRecord {
  const name = String(document.name ?? "Untitled Product");
  const description = String(document.description ?? "");
  const categoryRaw = String(document.category ?? "");
  const subCategoryRaw = String(document.subCategory ?? document.subcategory ?? "");
  const normalizedCategory = normalizeProductCategory({
    categoryRaw,
    subCategoryRaw,
    name,
    description,
  });

  return {
    id: String(document.$id ?? ""),
    slug: ensureSlug(String(document.slug ?? name), String(document.$id ?? "product")),
    name,
    description,
    sku: String(document.sku ?? document.$id ?? ""),
    category: normalizedCategory.category,
    subCategory: normalizedCategory.subCategory,
    categoryValue: categoryRaw.trim() || normalizedCategory.category,
    subCategoryValue: subCategoryRaw.trim() || normalizedCategory.subCategory,
    mainImageUrl: String(document.mainImageUrl ?? document.mainImage ?? ""),
    otherImageUrls: toStringArray(document.otherImageUrls ?? document.altImages),
    discountPrice: toNumber(document.discountPrice),
    originalPrice: toNumber(document.originalPrice),
    stockQty:
      typeof document.inStock === "boolean"
        ? (document.inStock ? 10 : 0)
        : toNumber(document.stockQty),
    rating: Math.min(
      5,
      Math.max(0, toNumber(document.rating ?? document.aggRating ?? document.averageRating ?? document.avgRating))
    ),
    ratingCount: Math.max(0, Math.trunc(toNumber(document.ratingCount ?? document.reviewCount ?? document.reviewsCount))),
    colorOptions: toStringArray(document.colorOptions),
    sizeOptions:
      Array.isArray(document.sizeOptions)
        ? toStringArray(document.sizeOptions)
        : typeof document.size === "string"
          ? [document.size]
          : [],
    isActive: typeof document.isActive === "boolean" ? document.isActive : true,
    createdAt: String(document.$createdAt ?? ""),
  };
}

function createReadClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!projectId) {
    return null;
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  const apiKey = process.env.APPWRITE_API_KEY;

  if (apiKey) {
    client.setKey(apiKey);
  }

  return client;
}

function isNotFoundError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeCode = "code" in error ? Number((error as { code?: unknown }).code) : NaN;
  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return maybeCode === 404 || maybeMessage.toLowerCase().includes("database with the requested id");
}

async function resolveDatabaseId(databases: Databases, configuredDatabaseId: string) {
  if (resolvedDatabaseIdCache) {
    return resolvedDatabaseIdCache;
  }

  const list = await databases.list();
  const normalizedConfigured = configuredDatabaseId.trim().toLowerCase();

  const matched = list.databases.find((database) => {
    const id = database.$id.toLowerCase();
    const name = database.name.toLowerCase();
    return id === normalizedConfigured || name === normalizedConfigured;
  });

  if (matched) {
    resolvedDatabaseIdCache = matched.$id;
    return matched.$id;
  }

  const byDefaultName = list.databases.find((database) => database.name.toLowerCase() === "naarithread");
  if (byDefaultName) {
    resolvedDatabaseIdCache = byDefaultName.$id;
    return byDefaultName.$id;
  }

  return configuredDatabaseId;
}

async function resolveContext() {
  const client = createReadClient();
  if (!client) {
    return null;
  }

  const databases = new Databases(client);
  const configuredDatabaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";

  let databaseId = configuredDatabaseId;
  try {
    databaseId = await resolveDatabaseId(databases, configuredDatabaseId);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }

  return {
    databases,
    databaseId,
    collectionId: SKU_COLLECTION_ID,
  };
}

export async function listProductsFromCollection() {
  const context = await resolveContext();
  if (!context) {
    return [] as ProductRecord[];
  }

  const queries: string[] = [Query.limit(100), Query.orderDesc("$createdAt")];

  const response = await context.databases.listDocuments(context.databaseId, context.collectionId, queries);

  return response.documents.map((document) => toProductRecord(document as Record<string, unknown>));
}

export async function getProductBySlug(slug: string) {
  const normalizedSlug = toSlug(slug);
  if (!normalizedSlug) {
    return null;
  }

  const context = await resolveContext();
  if (!context) {
    return null;
  }

  try {
    const bySlug = await context.databases.listDocuments(context.databaseId, context.collectionId, [
      Query.equal("slug", normalizedSlug),
      Query.limit(1),
    ]);

    if (bySlug.documents[0]) {
      return toProductRecord(bySlug.documents[0] as Record<string, unknown>);
    }
  } catch {
    // Fallback below handles projects that don't have slug indexed yet.
  }

  const all = await listProductsFromCollection();
  return all.find((item) => item.slug === normalizedSlug) ?? null;
}
