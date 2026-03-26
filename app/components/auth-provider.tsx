"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ID, OAuthProvider, type Models } from "appwrite";

import { appwritePublicConfig, hasPublicAuthConfig } from "@/lib/appwrite/constants";
import { getBrowserAccount } from "@/lib/appwrite/client";
import { getOrCreateUserProfile } from "@/lib/appwrite/profiles";

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
    if (!hasPublicAuthConfig()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const account = getBrowserAccount();
    if (!account) {
      setUser(null);
      setIsLoading(false);
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
      // 401 with "missing scopes" is expected when not logged in (guest user)
      // This is normal state, not an error
      const errorMessage = normalizeError(error);
      const isNotLoggedIn = errorMessage.includes("missing scopes");
      const logLevel = isNotLoggedIn ? "debug" : "error";

      console[logLevel as "debug" | "error"]("[auth-profile] refreshUser: session check", {
        state: isNotLoggedIn ? "not-logged-in (expected)" : "unexpected-error",
        error: formatErrorForLogging(error),
        message: errorMessage,
      });
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [syncUserProfile]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    // OAuth callbacks can return via full-page redirect where cookie propagation
    // and client hydration timing are slightly out of sync. Re-check on focus/restore.
    const revalidateSession = () => {
      void refreshUser();
    };

    window.addEventListener("focus", revalidateSession);
    window.addEventListener("pageshow", revalidateSession);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        revalidateSession();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", revalidateSession);
      window.removeEventListener("pageshow", revalidateSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshUser]);

  useEffect(() => {
    // Debug: Log when component mounts, useful for OAuth callback detection
    const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    if (urlParams.get("code") || urlParams.get("state")) {
      console.debug("[oauth-callback] detected OAuth callback parameters", {
        hasCode: !!urlParams.get("code"),
        hasState: !!urlParams.get("state"),
      });
    }
  }, []);

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

    const redirectUrl = `${typeof window !== "undefined" ? window.location.origin : appwritePublicConfig.endpoint}/account`;

    console.debug("[google-oauth] initiating sign in", {
      endpoint: appwritePublicConfig.endpoint,
      redirectUrl,
      projectId: appwritePublicConfig.projectId,
    });

    try {
      await account.createOAuth2Session(OAuthProvider.Google, redirectUrl, redirectUrl);
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
