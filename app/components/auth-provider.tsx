"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithCustomToken,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { toast } from "sonner";

import { appwritePublicConfig, hasPublicAuthConfig } from "@/lib/appwrite/constants";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { getOrCreateUserProfile } from "@/lib/appwrite/profiles";
import { readCartItems, readCartItemSelections, writeCartItems, writeCartItemSelection } from "@/lib/cart-state";
import { readWishlistItems, readWishlistItemSelections, writeWishlistItems, writeWishlistItemSelection } from "@/lib/wishlist-state";
import { mergeLocalAndRemoteShopState } from "@/lib/appwrite/shop-sync";

export type AuthUser = {
  $id: string;
  email: string;
  name: string;
  photoURL: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  sendEmailOtp: (email: string) => Promise<{ userId: string; email: string }>;
  verifyEmailOtp: (userId: string, secret: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  createAuthJwt: () => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export const EMAIL_LINK_STORAGE_KEY = "naarithread.emailForSignIn";

function normalizeError(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message);
    return message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

function formatErrorForLogging(error: unknown): Record<string, unknown> | unknown {
  if (typeof error === "object" && error !== null) {
    const details: Record<string, unknown> = {};
    if ("message" in error) details.message = error.message;
    if ("code" in error) details.code = error.code;
    if ("status" in error) details.status = error.status;
    if (Object.keys(details).length === 0) details.value = String(error);
    return details;
  }

  return error;
}

function toAuthUser(firebaseUser: User): AuthUser {
  return {
    $id: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    name: firebaseUser.displayName ?? firebaseUser.email ?? "Customer",
    photoURL: firebaseUser.photoURL ?? "",
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedUserId, setLastSyncedUserId] = useState("");
  const firebaseUserRef = useRef<User | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSessionPolling = useCallback((): void => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Poll the server for cross-device approval. When the user confirms the email
  // link on any device, this (originating) device receives a one-time custom
  // token and signs itself in.
  const startSessionPolling = useCallback(
    (sessionId: string, pollSecret: string): void => {
      stopSessionPolling();
      const startedAt = Date.now();
      const MAX_MS = 10 * 60 * 1000;

      pollTimerRef.current = setInterval(() => {
        if (Date.now() - startedAt > MAX_MS) {
          stopSessionPolling();
          return;
        }

        void (async () => {
          try {
            const res = await fetch("/api/auth/poll-session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionId, pollSecret }),
            });
            if (!res.ok) return;

            const data = (await res.json()) as { status: string; customToken?: string };
            if (data.status === "approved" && data.customToken) {
              stopSessionPolling();
              // Same-device links already sign in via /auth/complete; only adopt
              // the token when this device isn't authenticated yet.
              if (!getFirebaseAuth().currentUser) {
                await signInWithCustomToken(getFirebaseAuth(), data.customToken);
              }
            } else if (data.status === "denied" || data.status === "expired") {
              stopSessionPolling();
            }
          } catch {
            // Transient network error — keep polling until the timeout.
          }
        })();
      }, 3000);
    },
    [stopSessionPolling],
  );

  useEffect(() => stopSessionPolling, [stopSessionPolling]);

  const createAuthJwt = useCallback(async (): Promise<string> => {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Firebase auth session is not available.");
    }

    return currentUser.getIdToken();
  }, []);

  const syncUserProfile = useCallback(async (currentUser: AuthUser) => {
    const email = currentUser.email.toLowerCase();
    const isAdmin = appwritePublicConfig.adminEmails.includes(email);

    try {
      const jwt = await createAuthJwt();
      await getOrCreateUserProfile({ user: currentUser, isAdmin, jwt });
    } catch (error) {
      console.warn("[firebase-auth] profile sync failed", {
        userId: currentUser.$id,
        error: formatErrorForLogging(error),
      });
    }
  }, [createAuthJwt]);

  const refreshUser = useCallback(async (): Promise<void> => {
    const currentUser = firebaseUserRef.current ?? getFirebaseAuth().currentUser;
    const nextUser = currentUser ? toAuthUser(currentUser) : null;
    setUser(nextUser);
    setIsLoading(false);
    if (nextUser) {
      await syncUserProfile(nextUser);
    }
  }, [syncUserProfile]);

  useEffect(() => {
    if (!hasPublicAuthConfig()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    void setPersistence(auth, browserLocalPersistence).catch((error: unknown) => {
      console.warn("[firebase-auth] persistence setup failed", formatErrorForLogging(error));
    });

    // Email-link completion (and the cross-device handoff) is owned by the
    // dedicated /auth/complete route, so nothing to complete here.

    return onAuthStateChanged(auth, (currentUser) => {
      firebaseUserRef.current = currentUser;
      const nextUser = currentUser ? toAuthUser(currentUser) : null;
      setUser(nextUser);
      setIsLoading(false);
      if (nextUser) {
        void syncUserProfile(nextUser);
      }
    });
  }, [syncUserProfile]);

  useEffect(() => {
    if (!user?.$id || lastSyncedUserId === user.$id || syncingUserIdRef.current === user.$id) {
      return;
    }

    let alive = true;
    syncingUserIdRef.current = user.$id;

    const syncLocalShopState = async (): Promise<void> => {
      try {
        const jwt = await createAuthJwt();
        const merged = await mergeLocalAndRemoteShopState({
          jwt,
          userId: user.$id,
          localCart: readCartItems(),
          localWishlist: readWishlistItems(),
          localCartSelections: readCartItemSelections(),
          localWishlistSelections: readWishlistItemSelections(),
        });

        if (!alive) return;

        writeCartItems(merged.cart);
        writeWishlistItems(merged.wishlist);
        for (const [productId, selection] of Object.entries(merged.cartSelections)) {
          writeCartItemSelection(productId, selection);
        }
        for (const [productId, selection] of Object.entries(merged.wishlistSelections)) {
          writeWishlistItemSelection(productId, selection);
        }
        setLastSyncedUserId(user.$id);
      } catch {
        if (alive) setLastSyncedUserId(user.$id);
      } finally {
        if (syncingUserIdRef.current === user.$id) {
          syncingUserIdRef.current = null;
        }
      }
    };

    void syncLocalShopState();

    return () => {
      alive = false;
      if (syncingUserIdRef.current === user.$id) {
        syncingUserIdRef.current = null;
      }
    };
  }, [createAuthJwt, lastSyncedUserId, user?.$id]);

  const sendEmailOtp = useCallback(async (email: string): Promise<{ userId: string; email: string }> => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Firebase auth is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Open a cross-device session so the link can be confirmed on any device.
    const sessionRes = await fetch("/api/auth/create-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    if (!sessionRes.ok) {
      throw new Error("Could not start sign-in. Please try again.");
    }
    const { sessionId, pollSecret } = (await sessionRes.json()) as { sessionId: string; pollSecret: string };

    // 2. Send the Firebase email link, pointing at the dedicated completion route.
    const url = `${window.location.origin}/auth/complete?session=${sessionId}`;
    await sendSignInLinkToEmail(getFirebaseAuth(), normalizedEmail, {
      url,
      handleCodeInApp: true,
    });
    window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, normalizedEmail);

    // 3. Poll for approval — confirming on any device signs in this one.
    startSessionPolling(sessionId, pollSecret);

    return {
      userId: normalizedEmail,
      email: normalizedEmail,
    };
  }, [startSessionPolling]);

  const verifyEmailOtp = useCallback(async (): Promise<void> => {
    throw new Error("Firebase email sign-in uses secure email links instead of manual OTP codes.");
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<void> => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Firebase auth is not configured.");
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(getFirebaseAuth(), provider);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      stopSessionPolling();
      await signOut(getFirebaseAuth());
      firebaseUserRef.current = null;
      setUser(null);
      setLastSyncedUserId("");
      toast.success("Signed out", {
        description: "You have been logged out of NaariThread.",
      });
    } catch (error) {
      toast.error("Logout failed", {
        description: normalizeError(error),
      });
      throw error;
    }
  }, [stopSessionPolling]);

  const isAdmin = useMemo(() => {
    const email = user?.email.toLowerCase();
    return Boolean(email && appwritePublicConfig.adminEmails.includes(email));
  }, [user?.email]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      isConfigured: hasPublicAuthConfig(),
      isAdmin,
      refreshUser,
      sendEmailOtp,
      verifyEmailOtp,
      signInWithGoogle,
      createAuthJwt,
      logout,
    }),
    [createAuthJwt, isAdmin, isLoading, logout, refreshUser, sendEmailOtp, signInWithGoogle, user, verifyEmailOtp]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return {
    ...context,
    normalizeError,
  };
}
