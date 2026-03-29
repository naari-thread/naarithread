"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { type UserProfileDocument, updateUserProfile } from "@/lib/appwrite/profiles";
import { getBrowserDatabases } from "@/lib/appwrite/client";
import { appwritePublicConfig } from "@/lib/appwrite/constants";

type AccountDetailsModalProps = {
  onClose: () => void;
  showLogout?: boolean;
};

export function AccountDetailsModal({ onClose, showLogout = false }: AccountDetailsModalProps) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const databases = getBrowserDatabases();
        if (!databases) {
          throw new Error("Database not available");
        }

        const doc = await databases.getDocument<UserProfileDocument>(
          appwritePublicConfig.databaseId,
          appwritePublicConfig.usersCollectionId,
          user.$id
        );

        setProfile(doc);
        setFormData({
          fullName: doc.fullName || "",
          phone: doc.phone || "",
          address: doc.address || "",
        });
        setError(null);
      } catch (err) {
        console.error("Failed to fetch profile:", err);
        setError("Failed to load profile");
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!profile || !user) return;

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateUserProfile({
        documentId: profile.$id,
        fullName: formData.fullName,
        phone: formData.phone,
        address: formData.address,
      });

      setProfile(updated);
      // Show success message
      const successMsg = "Profile updated successfully";
      console.info(successMsg);
      setTimeout(() => onClose(), 1200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
    } catch (err) {
      console.error("Logout error:", err);
      setError("Failed to logout");
    }
  };

  return (
    <div className="flex flex-col max-h-[60vh] overflow-y-auto overscroll-contain space-y-4 px-1 pb-1 sm:px-2 sm:pb-2">
      {isLoading && !profile ? (
        <div className="flex min-h-40 items-center justify-center">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs text-primary/60">Loading profile...</span>
          </div>
        </div>
      ) : profile ? (
        <>
          <div className="space-y-3 sm:space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-primary/65 mb-1.5 sm:text-[0.7rem]">
                Full Name
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name"
                className="w-full rounded-lg border border-primary/16 bg-paper px-3 py-2.5 text-xs sm:text-sm text-primary placeholder:text-primary/50 outline-none transition focus:border-primary/40 focus:bg-secondary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-primary/65 mb-1.5 sm:text-[0.7rem]">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full rounded-lg border border-primary/16 bg-paper px-3 py-2.5 text-xs sm:text-sm text-primary/50 outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-[0.6rem] sm:text-[0.65rem] text-primary/50">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-primary/65 mb-1.5 sm:text-[0.7rem]">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter your phone number"
                className="w-full rounded-lg border border-primary/16 bg-paper px-3 py-2.5 text-xs sm:text-sm text-primary placeholder:text-primary/50 outline-none transition focus:border-primary/40 focus:bg-secondary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.12em] text-primary/65 mb-1.5 sm:text-[0.7rem]">
                Address
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter your address"
                rows={3}
                className="w-full rounded-lg border border-primary/16 bg-paper px-3 py-2.5 text-xs sm:text-sm text-primary placeholder:text-primary/50 outline-none transition focus:border-primary/40 focus:bg-secondary resize-none"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-2.5">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          <div className={`mt-4 grid shrink-0 ${showLogout ? "grid-cols-2 gap-2" : "grid-cols-1"}`}>
            {showLogout ? (
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                aria-label="Logout from account"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 px-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary transition hover:border-primary/40 hover:bg-primary/5 sm:h-10"
              >
                <DynamicHugeIcon name="ArrowLeft01Icon" className="h-3.5 w-3.5 sm:h-4 sm:w-4" iconStrokeWidth={2} aria-hidden={true} />
                Logout
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary transition hover:border-primary/40 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                  Saving...
                </>
              ) : (
                <>
                  <DynamicHugeIcon name="Mail01Icon" className="h-3.5 w-3.5 sm:h-4 sm:w-4" iconStrokeWidth={2} aria-hidden={true} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="flex min-h-40 items-center justify-center">
          <p className="text-xs sm:text-sm text-primary/60">Unable to load profile</p>
        </div>
      )}
    </div>
  );
}
