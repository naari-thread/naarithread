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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { toast } from "sonner";

import { appwritePublicConfig, hasPublicAuthConfig } from "@/lib/appwrite/constants";
import { getFirebaseAuth } from "@/lib/firebase/config";
import { clearCheckoutProfileCache } from "@/lib/checkout-cache";
import { readCartItems, readCartItemSelections, writeCartItems, writeCartItemSelection } from "@/lib/cart-state";
import { readWishlistItems, readWishlistItemSelections, writeWishlistItems, writeWishlistItemSelection } from "@/lib/wishlist-state";
import { mergeLocalAndRemoteShopState } from "@/lib/appwrite/shop-sync";

export type AuthUser = {
  $id: string;
  email: string;
  name: string;
  photoURL: string;
  emailVerified: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  isAdmin: boolean;
  refreshUser: () => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string, fullName: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  createAuthJwt: () => Promise<string>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    emailVerified: firebaseUser.emailVerified,
  };
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Map raw Firebase auth error codes to friendly, user-facing copy. */
function friendlyAuthError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address looks invalid.";
    case "auth/email-already-in-use":
      return "An account already exists with this email. Try signing in instead.";
    case "auth/weak-password":
      return "Password is too weak — use at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Sign-in was cancelled.";
    default:
      return normalizeError(error);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedUserId, setLastSyncedUserId] = useState("");
  const firebaseUserRef = useRef<User | null>(null);
  const syncingUserIdRef = useRef<string | null>(null);

  const createAuthJwt = useCallback(async (): Promise<string> => {
    const auth = getFirebaseAuth();
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Firebase auth session is not available.");
    }

    return currentUser.getIdToken();
  }, []);

  const syncUserProfile = useCallback(async (currentUser: AuthUser) => {
    try {
      // Server route (Admin SDK) creates/updates the profile row. Doing this
      // server-side avoids client Firestore writes, which security rules block
      // on production.
      const jwt = await createAuthJwt();
      await fetch("/api/auth/sync-profile", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
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

  const signUpWithEmailPassword = useCallback(
    async (email: string, password: string, fullName: string): Promise<void> => {
      if (!hasPublicAuthConfig()) {
        throw new Error("Firebase auth is not configured.");
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!emailPattern.test(normalizedEmail)) {
        throw new Error("Enter a valid email address.");
      }
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      try {
        const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), normalizedEmail, password);
        const trimmedName = fullName.trim();
        if (trimmedName) {
          await updateProfile(credential.user, { displayName: trimmedName }).catch(() => undefined);
        }
        // Send a verification email (non-blocking for sign-in). The continue URL
        // returns the user to the site after they verify.
        await sendEmailVerification(credential.user, { url: window.location.origin }).catch(() => undefined);
      } catch (error) {
        throw new Error(friendlyAuthError(error));
      }
    },
    [],
  );

  const signInWithEmailPassword = useCallback(async (email: string, password: string): Promise<void> => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Firebase auth is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), normalizedEmail, password);
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<void> => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Firebase auth is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!emailPattern.test(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), normalizedEmail, { url: window.location.origin });
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      throw new Error("You need to be signed in to resend a verification email.");
    }
    try {
      await sendEmailVerification(currentUser, { url: window.location.origin });
    } catch (error) {
      throw new Error(friendlyAuthError(error));
    }
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
      await signOut(getFirebaseAuth());
      firebaseUserRef.current = null;
      setUser(null);
      setLastSyncedUserId("");
      // Drop the cached checkout profile so the next user never sees stale details.
      clearCheckoutProfileCache();
      toast.success("Signed out", {
        description: "You have been logged out of NaariThread.",
      });
    } catch (error) {
      toast.error("Logout failed", {
        description: normalizeError(error),
      });
      throw error;
    }
  }, []);

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
      signUpWithEmailPassword,
      signInWithEmailPassword,
      sendPasswordReset,
      resendVerificationEmail,
      signInWithGoogle,
      createAuthJwt,
      logout,
    }),
    [
      createAuthJwt,
      isAdmin,
      isLoading,
      logout,
      refreshUser,
      resendVerificationEmail,
      sendPasswordReset,
      signInWithEmailPassword,
      signInWithGoogle,
      signUpWithEmailPassword,
      user,
    ]
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
