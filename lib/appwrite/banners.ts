import { Client, Databases, Query } from "node-appwrite";

export type BannerRecord = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

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

async function resolveBannerCollectionId(databases: Databases, databaseId: string) {
  for (const collectionId of ["banner", "banners"]) {
    try {
      await databases.getCollection(databaseId, collectionId);
      return collectionId;
    } catch {
      // Continue fallback lookup.
    }
  }

  return null;
}

function toBannerRecord(document: Record<string, unknown>): BannerRecord {
  return {
    id: String(document.$id ?? ""),
    title: String(document.title ?? "Wear Your Story."),
    subtitle: String(document.subtitle ?? "Discover premium fashion edits crafted for modern Indian women."),
    imageUrl: String(document.imageUrl ?? ""),
    ctaLabel: String(document.ctaLabel ?? "Shop the Collection"),
    ctaUrl: String(document.ctaUrl ?? "/products"),
  };
}

export async function getPrimaryBanner() {
  const client = createReadClient();
  if (!client) {
    return null;
  }

  const databases = new Databases(client);
  const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
  const collectionId = await resolveBannerCollectionId(databases, databaseId);

  if (!collectionId) {
    return null;
  }

  const nowIso = new Date().toISOString();
  const list = await databases.listDocuments(databaseId, collectionId, [
    Query.equal("isActive", true),
    Query.orderAsc("position"),
    Query.limit(10),
  ]);

  const active = list.documents.find((doc) => {
    const startAt = String(doc.startAt ?? "").trim();
    const endAt = String(doc.endAt ?? "").trim();
    const afterStart = !startAt || startAt <= nowIso;
    const beforeEnd = !endAt || endAt >= nowIso;
    return afterStart && beforeEnd;
  });

  if (!active) {
    return null;
  }

  return toBannerRecord(active as Record<string, unknown>);
}
