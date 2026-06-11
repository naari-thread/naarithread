import type { Databases } from "node-appwrite";
import { Query } from "node-appwrite";

// Module-level cache: once a collection ID resolves, skip the probe on
// subsequent calls within the same serverless function lifetime.
const resolvedCache = new Map<string, string>();

export async function resolveCollectionId(args: {
  databases: Databases;
  databaseId: string;
  candidates: readonly string[];
}) {
  const cacheKey = `${args.databaseId}::${args.candidates.join(",")}`;
  const cached = resolvedCache.get(cacheKey);
  if (cached) return cached;

  for (const collectionId of args.candidates) {
    try {
      await args.databases.listDocuments(args.databaseId, collectionId, [Query.limit(1)]);
      resolvedCache.set(cacheKey, collectionId);
      return collectionId;
    } catch {
      // Continue until a valid collection is found.
    }
  }

  return null;
}
