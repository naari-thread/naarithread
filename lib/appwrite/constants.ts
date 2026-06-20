import { firebasePublicConfig, getAdminEmails, hasFirebasePublicConfig } from "@/lib/firebase/config";

function normalizeEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export const appwritePublicConfig = {
  endpoint: `https://${firebasePublicConfig.authDomain}`,
  projectId: firebasePublicConfig.projectId,
  databaseId: firebasePublicConfig.projectId,
  usersCollectionId: "users",
  adminEmails: getAdminEmails(),
};

export const appwriteServerConfig = {
  endpoint: `https://${firebasePublicConfig.authDomain}`,
  projectId: normalizeEnv(process.env.FIREBASE_PROJECT_ID) || firebasePublicConfig.projectId,
  apiKey: "",
  databaseId: normalizeEnv(process.env.FIREBASE_PROJECT_ID) || firebasePublicConfig.projectId,
};

export function hasPublicAuthConfig(): boolean {
  return hasFirebasePublicConfig();
}

export function hasUsersCollectionConfig(): boolean {
  return hasFirebasePublicConfig();
}
