function normalizeEnv(value: string | undefined) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export const appwritePublicConfig = {
  endpoint: normalizeEnv(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT) || "https://cloud.appwrite.io/v1",
  projectId: normalizeEnv(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID),
  databaseId: normalizeEnv(process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID),
  usersCollectionId: normalizeEnv(process.env.NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID) || "users",
  adminEmails:
    normalizeEnv(process.env.NEXT_PUBLIC_ADMIN_EMAILS)
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? [],
};

export function hasPublicAuthConfig() {
  return Boolean(appwritePublicConfig.projectId);
}

export function hasUsersCollectionConfig() {
  return Boolean(appwritePublicConfig.projectId && appwritePublicConfig.databaseId);
}

export const appwriteServerConfig = {
  endpoint: normalizeEnv(process.env.APPWRITE_ENDPOINT) || "https://cloud.appwrite.io/v1",
  projectId: normalizeEnv(process.env.APPWRITE_PROJECT_ID),
  apiKey: normalizeEnv(process.env.APPWRITE_API_KEY),
  databaseId: normalizeEnv(process.env.APPWRITE_DATABASE_ID) || "naarithread",
};
