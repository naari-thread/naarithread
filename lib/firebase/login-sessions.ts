import { createHash, randomBytes } from "crypto";

import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Cross-device login sessions.
 *
 * Powers the "start on laptop, confirm from the email link on your phone,
 * laptop logs in" flow. A session doc lives only in Firestore (admin-only;
 * the catch-all rule in firestore.rules denies all client access) and is
 * single-use with a short TTL.
 *
 * Security model:
 *  - The Firebase custom token is NEVER stored here and never sent to the
 *    phone — it is minted on demand only for the caller that holds the
 *    `pollSecret` (the originating laptop). We persist only hashes.
 *  - Email is stored hashed so the doc carries no readable PII.
 */

const COLLECTION = "loginSessions";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

type LoginSessionStatus = "pending" | "approved";

type LoginSessionDoc = {
  emailHash: string;
  pollSecretHash: string;
  status: LoginSessionStatus;
  approvedUid: string;
  createdAt: number;
  expiresAt: number;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Create a pending session. Returns the public `sessionId` (embedded in the
 * email link) and the private `pollSecret` (kept in laptop memory only).
 */
export async function createLoginSession(email: string): Promise<{ sessionId: string; pollSecret: string }> {
  const sessionId = randomBytes(24).toString("base64url");
  const pollSecret = randomBytes(32).toString("base64url");
  const now = Date.now();

  const doc: LoginSessionDoc = {
    emailHash: sha256(normalizeEmail(email)),
    pollSecretHash: sha256(pollSecret),
    status: "pending",
    approvedUid: "",
    createdAt: now,
    expiresAt: now + TTL_MS,
  };

  await getAdminDb().collection(COLLECTION).doc(sessionId).set(doc);
  return { sessionId, pollSecret };
}

/**
 * Mark a session approved after the email owner verified on any device.
 * Binds the session to the verified uid; throws on mismatch/expiry.
 */
export async function approveLoginSession(sessionId: string, uid: string, email: string): Promise<void> {
  const ref = getAdminDb().collection(COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("This sign-in request was not found or has expired.");
  }

  const data = snap.data() as LoginSessionDoc | undefined;
  if (!data || Date.now() > data.expiresAt) {
    await ref.delete().catch(() => undefined);
    throw new Error("This sign-in request has expired. Please start again.");
  }

  if (data.emailHash !== sha256(normalizeEmail(email))) {
    throw new Error("This sign-in link does not match the email you entered.");
  }

  await ref.update({ status: "approved", approvedUid: uid });
}

export type ConsumeResult =
  | { status: "pending" }
  | { status: "denied" }
  | { status: "expired" }
  | { status: "approved"; uid: string };

/**
 * Polled by the originating laptop. When the session is approved AND the
 * caller proves it holds the `pollSecret`, the session is consumed (deleted)
 * and the verified uid is returned so the caller can mint a custom token.
 */
export async function consumeApprovedSession(sessionId: string, pollSecret: string): Promise<ConsumeResult> {
  const ref = getAdminDb().collection(COLLECTION).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) {
    return { status: "expired" };
  }

  const data = snap.data() as LoginSessionDoc | undefined;
  if (!data || Date.now() > data.expiresAt) {
    await ref.delete().catch(() => undefined);
    return { status: "expired" };
  }

  if (data.pollSecretHash !== sha256(pollSecret)) {
    return { status: "denied" };
  }

  if (data.status !== "approved") {
    return { status: "pending" };
  }

  // Single-use: consume before handing back the uid.
  await ref.delete().catch(() => undefined);
  return { status: "approved", uid: data.approvedUid };
}
