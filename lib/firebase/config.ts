import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function normalizeEnv(value: string | undefined): string {
  return value?.trim() ?? "";
}

export const firebasePublicConfig = {
  apiKey: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: normalizeEnv(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

export function getFirebaseClientApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(firebasePublicConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseClientApp());
}

export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseClientApp());
}

export function hasFirebasePublicConfig(): boolean {
  return Boolean(firebasePublicConfig.apiKey && firebasePublicConfig.authDomain && firebasePublicConfig.projectId);
}

export function parseAdminEmails(source: string): string[] {
  return source
    .split(",")
    .map((value) => value.trim().replace(/^["']+|["']+$/g, "").toLowerCase())
    .filter(Boolean);
}

export function getAdminEmails(): string[] {
  const source = normalizeEnv(process.env.NEXT_PUBLIC_ADMIN_EMAILS) || normalizeEnv(process.env.ADMIN_EMAILS);
  return parseAdminEmails(source);
}
