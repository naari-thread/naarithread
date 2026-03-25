import { Client, Databases, Query } from "node-appwrite";

export type ProductRecord = {
  id: string;
  name: string;
  description: string;
  sku: string;
  category: string;
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
};

let resolvedDatabaseIdCache: string | null = null;

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function toProductRecord(document: Record<string, unknown>): ProductRecord {
  return {
    id: String(document.$id ?? ""),
    name: String(document.name ?? "Untitled Product"),
    description: String(document.description ?? ""),
    sku: String(document.sku ?? ""),
    category: String(document.category ?? ""),
    mainImageUrl: String(document.mainImageUrl ?? ""),
    otherImageUrls: toStringArray(document.otherImageUrls),
    discountPrice: toNumber(document.discountPrice),
    originalPrice: toNumber(document.originalPrice),
    stockQty: toNumber(document.stockQty),
    rating: toNumber(document.rating),
    ratingCount: toNumber(document.ratingCount),
    colorOptions: toStringArray(document.colorOptions),
    sizeOptions: toStringArray(document.sizeOptions),
    isActive: typeof document.isActive === "boolean" ? document.isActive : true,
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

export async function listProductsFromCollection(category?: string) {
  const client = createReadClient();
  if (!client) {
    return [] as ProductRecord[];
  }

  const databases = new Databases(client);
  const configuredDatabaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";

  const queries: string[] = [Query.limit(100), Query.orderDesc("$createdAt")];

  if (category) {
    queries.push(Query.equal("category", category));
  }

  let response;
  try {
    response = await databases.listDocuments(configuredDatabaseId, "products", queries);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const resolvedDatabaseId = await resolveDatabaseId(databases, configuredDatabaseId);
    response = await databases.listDocuments(resolvedDatabaseId, "products", queries);
  }

  return response.documents.map((document) => toProductRecord(document as Record<string, unknown>));
}
