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
import { ID, type Models } from "appwrite";

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

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncUserProfile = useCallback(async (currentUser: Models.User<Models.Preferences>) => {
    const email = currentUser.email?.toLowerCase() ?? "";
    const isAdmin = appwritePublicConfig.adminEmails.includes(email);
    console.info("[auth-profile] sync start", {
      userId: currentUser.$id,
      email: currentUser.email,
      isAdmin,
    });
    const profile = await getOrCreateUserProfile({ user: currentUser, isAdmin });

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
  }, []);

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

      try {
        await syncUserProfile(currentUser);
      } catch (error) {
        // Profile sync issues should not log users out if session is valid.
        console.error("[auth-profile] client sync failed", {
          userId: currentUser.$id,
          error,
        });
      }
    } catch {
      console.warn("[auth-profile] refreshUser: no active session");
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [syncUserProfile]);

  useEffect(() => {
    void refreshUser();
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

  const logout = useCallback(async () => {
    const account = getBrowserAccount();
    if (!account) {
      return;
    }

    await account.deleteSession("current");
    setUser(null);
  }, []);

  const createAuthJwt = useCallback(async () => {
    const account = getBrowserAccount();
    if (!account) {
      throw new Error("Appwrite auth is not configured.");
    }

    const response = await account.createJWT({ duration: 900 });
    return response.jwt;
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
      createAuthJwt,
      logout,
    }),
    [createAuthJwt, isAdmin, isLoading, refreshUser, sendEmailOtp, user, verifyEmailOtp, logout]
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
