import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export const firebasePublicConfig = {
  apiKey: env("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: env("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: env("NEXT_PUBLIC_FIREBASE_APP_ID"),
  measurementId: env("NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID"),
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
  const source = process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? process.env.ADMIN_EMAILS ?? "";
  return parseAdminEmails(source);
}
