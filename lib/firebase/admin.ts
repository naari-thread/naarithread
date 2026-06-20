import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { parseAdminEmails } from "@/lib/firebase/config";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function getPrivateKey(): string {
  return env("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getCredentialConfig(): { projectId: string; clientEmail: string; privateKey: string } | null {
  const json = env("FIREBASE_SERVICE_ACCOUNT_KEY");
  if (json) {
    const parsed = JSON.parse(json) as { project_id?: string; client_email?: string; private_key?: string };
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  const projectId = env("FIREBASE_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || "naarithread";
  const clientEmail = env("FIREBASE_CLIENT_EMAIL");
  const privateKey = getPrivateKey();
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

function hasApplicationDefaultCredentials(): boolean {
  return Boolean(env("GOOGLE_APPLICATION_CREDENTIALS"));
}

export function getFirebaseAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const credentialConfig = getCredentialConfig();
  if (credentialConfig) {
    return initializeApp({
      credential: cert({
        projectId: credentialConfig.projectId,
        clientEmail: credentialConfig.clientEmail,
        privateKey: credentialConfig.privateKey,
      }),
      projectId: credentialConfig.projectId,
    });
  }

  if (hasApplicationDefaultCredentials()) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: env("FIREBASE_PROJECT_ID") || env("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || "naarithread",
    });
  }

  throw new Error(
    "Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY."
  );
}

export function getAdminDb(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export function getServerAdminEmails(): string[] {
  const source = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "";
  return parseAdminEmails(source);
}
