import { Client, Databases, Query } from "node-appwrite";

export type BannerRecord = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaLabel: string;
  ctaUrl: string;
};

function createReadClient(): Client | null {
  const endpoint = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "naarithread.firebaseapp.com";
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread";

  if (!projectId) {
    return null;
  }

  return new Client().setEndpoint(endpoint).setProject(projectId);
}

async function resolveBannerCollectionId(databases: Databases, databaseId: string): Promise<string | null> {
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

export async function getActiveBanners(): Promise<BannerRecord[]> {
  const client = createReadClient();
  if (!client) {
    return [];
  }

  const databases = new Databases(client);
  const databaseId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "naarithread";
  const collectionId = await resolveBannerCollectionId(databases, databaseId);

  if (!collectionId) {
    return [];
  }

  const nowIso = new Date().toISOString();
  const list = await databases.listDocuments(databaseId, collectionId, [
    Query.orderAsc("position"),
    Query.limit(50),
  ]);

  return list.documents
    .filter((doc) => {
      const isActive = typeof doc.isActive === "boolean" ? doc.isActive : true;
      const startAt = String(doc.startAt ?? "").trim();
      const endAt = String(doc.endAt ?? "").trim();
      const afterStart = !startAt || startAt <= nowIso;
      const beforeEnd = !endAt || endAt >= nowIso;
      return isActive && afterStart && beforeEnd;
    })
    .map((doc) => toBannerRecord(doc as Record<string, unknown>));
}

export async function getPrimaryBanner(): Promise<BannerRecord | null> {
  const banners = await getActiveBanners();
  return banners[0] ?? null;
}
