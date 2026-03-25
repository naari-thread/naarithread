"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EmailOtpAuthForm } from "@/app/components/email-otp-auth-form";
import { useAuth } from "@/app/components/auth-provider";
import {
  getOrCreateUserProfile,
  updateUserProfile,
  type UserProfileDocument,
} from "@/lib/appwrite/profiles";
import { getBrowserAccount } from "@/lib/appwrite/client";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated, isAdmin, normalizeError, logout, createAuthJwt } = useAuth();

  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isOpeningAdmin, setIsOpeningAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function syncProfile() {
      if (!user) {
        setProfile(null);
        setFullName("");
        setPhone("");
        setAddress("");
        return;
      }

      setIsProfileLoading(true);
      setStatusMessage("");

      try {
        const synced = await getOrCreateUserProfile({ user, isAdmin });

        if (!isMounted) {
          return;
        }

        setProfile(synced);
        setFullName(synced?.fullName ?? user.name ?? "");
        setPhone(synced?.phone ?? "");
        setAddress(synced?.address ?? "");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setStatusMessage(normalizeError(error));
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    }

    void syncProfile();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, normalizeError, user]);

  const hasChanges = useMemo(() => {
    if (!profile) {
      return Boolean(fullName.trim() || phone.trim() || address.trim());
    }

    return (
      fullName.trim() !== (profile.fullName ?? "") ||
      phone !== (profile.phone ?? "") ||
      address !== (profile.address ?? "")
    );
  }, [address, fullName, phone, profile]);

  async function handleProfileUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile?.$id) {
      setStatusMessage("Users collection is not configured yet. Update environment variables and run setup script.");
      return;
    }

    setIsSaving(true);
    setStatusMessage("");

    try {
      const account = getBrowserAccount();
      if (account && fullName.trim() && fullName.trim() !== user?.name) {
        await account.updateName(fullName.trim());
      }

      const updated = await updateUserProfile({
        documentId: profile.$id,
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });

      setProfile(updated);
      setStatusMessage("Profile updated successfully.");
      toast.success("Profile updated", {
        description: "Your account details have been saved.",
      });
    } catch (error) {
      const message = normalizeError(error);
      setStatusMessage(message);
      toast.error("Could not update profile", { description: message });
    } finally {
      setIsSaving(false);
    }
  }

  async function openAdminDashboard() {
    setIsOpeningAdmin(true);
    setStatusMessage("");

    try {
      const jwt = await createAuthJwt();
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to open admin gateway session.");
      }

      toast.success("Admin session opened", {
        description: "Redirecting to dashboard.",
      });
      router.push("/admindashboard");
    } catch (error) {
      const message = normalizeError(error);
      setStatusMessage(message);
      toast.error("Admin access failed", { description: message });
    } finally {
      setIsOpeningAdmin(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-18 md:pt-30">
      <section className="mx-auto w-full max-w-5xl">
        <header className="border-b border-primary/15 pb-5 sm:pb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Profile</p>
          <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Account</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/82 sm:text-base">
            Secure sign in via Email OTP. Keep your profile details updated for faster checkout,
            shipping accuracy, and smoother order support.
          </p>
        </header>

        {isLoading ? (
          <div className="mt-8 rounded-2xl border border-primary/12 bg-secondary p-6 text-sm text-primary/80">
            Checking your account session...
          </div>
        ) : null}

        {!isLoading && !isAuthenticated ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8"
          >
            <EmailOtpAuthForm
              title="Sign up / Login"
              description="Start with your email. We will send a one-time password to securely continue."
            />
          </motion.div>
        ) : null}

        {!isLoading && isAuthenticated ? (
          <motion.form
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleProfileUpdate}
            className="mt-8 rounded-2xl border border-primary/15 bg-secondary p-5 sm:p-7"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">Full Name</span>
                <input
                  type="text"
                  aria-label="Editable full name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value.slice(0, 120))}
                  placeholder="Your full name"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm text-primary outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.12)]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">Email Address</span>
                <input
                  type="email"
                  aria-label="Account email"
                  value={user?.email ?? ""}
                  disabled
                  className="h-11 rounded-xl border border-primary/15 bg-paper px-3 text-sm text-primary/70"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">Phone Number</span>
                <input
                  type="tel"
                  aria-label="Editable phone number"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.slice(0, 20))}
                  placeholder="+91 98XXXXXXXX"
                  className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm text-primary outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.12)]"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/65">Address</span>
                <textarea
                  aria-label="Editable address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value.slice(0, 450))}
                  rows={3}
                  placeholder="House, street, city, state, PIN"
                  className="rounded-xl border border-primary/18 bg-paper px-3 py-2.5 text-sm text-primary outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.12)]"
                />
              </label>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <button
                type="submit"
                aria-label="Save account details"
                disabled={isSaving || isProfileLoading || !hasChanges}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>

              <button
                type="button"
                aria-label="Logout from account"
                onClick={() => void logout()}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-paper px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45"
              >
                Logout
              </button>

              {isAdmin ? (
                <>
                  <button
                    type="button"
                    aria-label="Open admin dashboard"
                    onClick={() => void openAdminDashboard()}
                    disabled={isOpeningAdmin}
                    className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/22 bg-paper px-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary transition hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isOpeningAdmin ? "Opening..." : "Open Admin"}
                  </button>
                </>
              ) : null}
            </div>

            {isAdmin ? (
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/65">
                Admin-enabled account
              </p>
            ) : null}

            {isProfileLoading ? <p className="mt-4 text-sm text-primary/75">Syncing profile data...</p> : null}
            {statusMessage ? <p className="mt-4 text-sm text-primary/85">{statusMessage}</p> : null}
          </motion.form>
        ) : null}
      </section>
    </main>
  );
}
