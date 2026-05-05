import { Account, Client, Databases } from "node-appwrite";

function mustEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getAdminEmails() {
  const source = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";

  return source
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedAdminEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return getAdminEmails().includes(normalized);
}

export function createApiKeyClient() {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing required environment variable: APPWRITE_PROJECT_ID");
  }
  const apiKey = mustEnv("APPWRITE_API_KEY");

  return new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
}

export function createDatabasesWithApiKey() {
  return new Databases(createApiKeyClient());
}

export async function getUserFromJwt(jwt: string) {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  if (!projectId) {
    throw new Error("Missing required environment variable: APPWRITE_PROJECT_ID");
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setJWT(jwt);
  const account = new Account(client);

  return account.get();
}

export function getDatabaseId() {
  return process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "naarithread";
}
