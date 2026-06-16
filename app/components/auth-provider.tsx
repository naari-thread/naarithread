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
import { ID, OAuthProvider, type Models } from "appwrite";

import { appwritePublicConfig, hasPublicAuthConfig } from "@/lib/appwrite/constants";
import { getBrowserAccount } from "@/lib/appwrite/client";
import { getOrCreateUserProfile } from "@/lib/appwrite/profiles";
import { readCartItems, writeCartItems } from "@/lib/cart-state";
import { readWishlistItems, writeWishlistItems } from "@/lib/wishlist-state";
import { mergeLocalAndRemoteShopState } from "@/lib/appwrite/shop-sync";

type AuthContextValue = {
  user: Models.User<Models.Preferences> | null;
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

function normalizeError(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = String(error.message);
    return message || "Something went wrong. Please try again.";
  }

  return "Something went wrong. Please try again.";
}

function formatErrorForLogging(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const details: Record<string, unknown> = {};
    if ("message" in error) details.message = error.message;
    if ("code" in error) details.code = error.code;
    if ("status" in error) details.status = error.status;
    if ("response" in error) details.response = error.response;
    if (Object.keys(details).length === 0) {
      details.value = String(error);
    }
    return details;
  }

  return error;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedUserId, setLastSyncedUserId] = useState("");
  const isRefreshingRef = useRef(false);
  const syncingUserIdRef = useRef<string | null>(null);
  const lastRevalidateAtRef = useRef(0);

  const createAuthJwt = useCallback(async () => {
    const account = getBrowserAccount();
    if (!account) {
      throw new Error("Appwrite auth is not configured.");
    }

    try {
      const response = await account.createJWT({ duration: 900 });
      return response.jwt;
    } catch {
      try {
        const response = await account.createJWT(900);
        return response.jwt;
      } catch {
        const response = await account.createJWT();
        return response.jwt;
      }
    }
  }, []);

  const syncUserProfile = useCallback(async (currentUser: Models.User<Models.Preferences>) => {
    const email = currentUser.email?.toLowerCase() ?? "";
    const isAdmin = appwritePublicConfig.adminEmails.includes(email);
    console.info("[auth-profile] sync start", {
      userId: currentUser.$id,
      email: currentUser.email,
      isAdmin,
    });
    try {
      let profile = null;

      try {
        const jwt = await createAuthJwt();
        profile = await getOrCreateUserProfile({ user: currentUser, isAdmin, jwt });
      } catch (jwtError) {
        console.warn("[auth-profile] jwt sync path failed, falling back to session sync", {
          userId: currentUser.$id,
          error: formatErrorForLogging(jwtError),
        });
        profile = await getOrCreateUserProfile({ user: currentUser, isAdmin });
      }

      if (!profile) {
        console.warn("[auth-profile] client sync returned null profile (existing unreadable profile or permission restriction)", {
          userId: currentUser.$id,
        });
        return;
      }

      console.info("[auth-profile] client sync success", {
        userId: currentUser.$id,
        profileId: profile.$id,
      });
    } catch (error) {
      console.error("[auth-profile] client sync failed", {
        userId: currentUser.$id,
        error: formatErrorForLogging(error),
      });
    }
  }, [createAuthJwt]);

  const refreshUser = useCallback(async () => {
    if (isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;

    if (!hasPublicAuthConfig()) {
      setUser(null);
      setIsLoading(false);
      isRefreshingRef.current = false;
      return;
    }

    const account = getBrowserAccount();
    if (!account) {
      setUser(null);
      setIsLoading(false);
      isRefreshingRef.current = false;
      return;
    }

    try {
      const currentUser = await account.get();
      setUser(currentUser);
      console.info("[auth-profile] refreshUser resolved current session", {
        userId: currentUser.$id,
        email: currentUser.email,
      });

      await syncUserProfile(currentUser);
    } catch (error) {
      const errorMessage = normalizeError(error);
      // Only clear user on genuine auth failures (401 / session expired).
      // Network errors and timeouts on focus-triggered revalidation should
      // not wipe user state — they're transient and would clear the cart form.
      const isAuthFailure =
        errorMessage.includes("missing scopes") ||
        errorMessage.includes("unauthorized") ||
        errorMessage.includes("invalid session") ||
        errorMessage.includes("user (role: guests)");
      const logLevel = isAuthFailure ? "debug" : "warn";

      console[logLevel as "debug" | "warn"]("[auth-profile] refreshUser: session check", {
        state: isAuthFailure ? "not-logged-in (expected)" : "transient-error (keeping user)",
        error: formatErrorForLogging(error),
        message: errorMessage,
      });
      if (isAuthFailure) {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [syncUserProfile]);

  useEffect(() => {
    // Appwrite's createOAuth2Token appends ?userId=...&secret=... to the success
    // URL after Google OAuth. We must call createSession() with those params to
    // complete the login before running the normal session check.
    const completeOAuthIfNeeded = async () => {
      if (typeof window === "undefined") {
        await refreshUser();
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId");
      const secret = params.get("secret");

      if (userId && secret) {
        // Clean the params from the URL immediately so a refresh doesn't re-run.
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("userId");
        cleanUrl.searchParams.delete("secret");
        window.history.replaceState({}, "", cleanUrl.toString());

        const account = getBrowserAccount();
        if (account) {
          try {
            await account.createSession({ userId, secret });
            console.info("[google-oauth] session created from OAuth token");
          } catch (error) {
            console.error("[google-oauth] failed to create session from OAuth token", {
              error: formatErrorForLogging(error),
            });
          }
        }
      }

      await refreshUser();
    };

    void completeOAuthIfNeeded();
  }, [refreshUser]);

  useEffect(() => {
    if (!user?.$id || lastSyncedUserId === user.$id || syncingUserIdRef.current === user.$id) {
      return;
    }

    let alive = true;
    syncingUserIdRef.current = user.$id;

    const syncLocalShopState = async () => {
      try {
        const jwt = await createAuthJwt();
        const merged = await mergeLocalAndRemoteShopState({
          jwt,
          userId: user.$id,
          localCart: readCartItems(),
          localWishlist: readWishlistItems(),
        });

        if (!alive) {
          return;
        }

        writeCartItems(merged.cart);
        writeWishlistItems(merged.wishlist);
        setLastSyncedUserId(user.$id);
      } catch {
        if (!alive) {
          return;
        }
        // Silent fallback keeps local-first behavior available when sync is blocked.
        setLastSyncedUserId(user.$id);
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

  useEffect(() => {
    // OAuth callbacks can return via full-page redirect where cookie propagation
    // and client hydration timing are slightly out of sync. Re-check on focus/restore.
    const revalidateSession = () => {
      const now = Date.now();
      if (now - lastRevalidateAtRef.current < 3000) {
        return;
      }

      lastRevalidateAtRef.current = now;
      void refreshUser();
    };

    window.addEventListener("focus", revalidateSession);

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        revalidateSession();
      }
    };

    window.addEventListener("pageshow", onPageShow);

    return () => {
      window.removeEventListener("focus", revalidateSession);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [refreshUser]);


  const sendEmailOtp = useCallback(async (email: string) => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Appwrite auth is not configured.");
    }

    const account = getBrowserAccount();
    if (!account) {
      throw new Error("Appwrite auth is not configured.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    let token;

    try {
      // Prefer object-style API for Appwrite SDK v23+.
      token = await account.createEmailToken({ userId: ID.unique(), email: normalizedEmail });
    } catch {
      // Backward-compatible fallback for older overloaded signature usage.
      token = await account.createEmailToken(ID.unique(), normalizedEmail);
    }

    return {
      userId: token.userId,
      email: normalizedEmail,
    };
  }, []);

  const verifyEmailOtp = useCallback(async (userId: string, secret: string) => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Appwrite auth is not configured.");
    }

    const account = getBrowserAccount();
    if (!account) {
      throw new Error("Appwrite auth is not configured.");
    }

    try {
      await account.createSession({ userId, secret });
    } catch {
      await account.createSession(userId, secret);
    }
    await refreshUser();
  }, [refreshUser]);

  const signInWithGoogle = useCallback(async () => {
    if (!hasPublicAuthConfig()) {
      throw new Error("Appwrite auth is not configured.");
    }

    const account = getBrowserAccount();
    if (!account) {
      throw new Error("Appwrite auth is not configured.");
    }

    // Return to the page the user was on. /account is mobile-only and shows
    // a blank screen on desktop after the OAuth redirect.
    const redirectUrl = typeof window !== "undefined" ? window.location.href : `${appwritePublicConfig.endpoint}/`;

    console.debug("[google-oauth] initiating sign in", {
      endpoint: appwritePublicConfig.endpoint,
      redirectUrl,
      projectId: appwritePublicConfig.projectId,
    });

    try {
      await account.createOAuth2Token(OAuthProvider.Google, redirectUrl, redirectUrl);
    } catch (error) {
      console.error("[google-oauth] sign in failed", {
        error: formatErrorForLogging(error),
        redirectUrl,
      });
      
      const message = normalizeError(error);
      
      if (message.toLowerCase().includes("failed to fetch")) {
        throw new Error("Could not reach authentication service. Please check your network connection and try again.");
      }
      if (message.toLowerCase().includes("user cancelled") || message.toLowerCase().includes("cancelled")) {
        throw new Error("Google sign-in was cancelled. Please try again.");
      }
      if (message.toLowerCase().includes("401") || message.toLowerCase().includes("unauthorized")) {
        throw new Error("Google authentication failed. Please ensure: 1) You added your email as a test user in Google Cloud Console, 2) Your OAuth app is configured in Appwrite, 3) You're signed in with the correct Google account.");
      }
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    const account = getBrowserAccount();
    if (!account) {
      return;
    }

    await account.deleteSession("current");
    setUser(null);
    setLastSyncedUserId("");
  }, []);

  const isAdmin = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) {
      return false;
    }

    return appwritePublicConfig.adminEmails.includes(email);
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
    [createAuthJwt, isAdmin, isLoading, refreshUser, sendEmailOtp, user, verifyEmailOtp, signInWithGoogle, logout]
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
