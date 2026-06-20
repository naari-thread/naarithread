import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";

import { getFirebaseAdminApp } from "@/lib/firebase/admin";

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  return getAdminAuth().verifyIdToken(idToken);
}
