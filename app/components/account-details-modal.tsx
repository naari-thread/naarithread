"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/components/auth-provider";
import { showActionToast } from "@/lib/action-toast";
import { readUserProfile, type UserProfileDocument, updateUserProfile } from "@/lib/appwrite/profiles";

type AddressFields = {
  houseNo: string;
  locality: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type FormData = {
  fullName: string;
  phone: string;
  address: AddressFields;
};

function parseAddress(raw: string): AddressFields {
  const blank: AddressFields = { houseNo: "", locality: "", landmark: "", city: "", state: "", postalCode: "", country: "India" };
  if (!raw) return blank;
  try {
    const parsed = JSON.parse(raw) as Partial<AddressFields & { line1?: string }>;
    return {
      houseNo: parsed.houseNo || "",
      locality: parsed.locality || "",
      landmark: parsed.landmark || "",
      city: parsed.city || "",
      state: parsed.state || "",
      postalCode: parsed.postalCode || "",
      country: parsed.country || "India",
    };
  } catch {
    return { ...blank, houseNo: raw };
  }
}

function serializeAddress(a: AddressFields): string {
  return JSON.stringify(a);
}

function formEqual(a: FormData, b: FormData): boolean {
  return (
    a.fullName === b.fullName &&
    a.phone === b.phone &&
    a.address.houseNo === b.address.houseNo &&
    a.address.locality === b.address.locality &&
    a.address.landmark === b.address.landmark &&
    a.address.city === b.address.city &&
    a.address.state === b.address.state &&
    a.address.postalCode === b.address.postalCode &&
    a.address.country === b.address.country
  );
}

const INPUT_CLS = "w-full rounded-lg border border-primary/16 bg-paper px-3 py-2.5 text-sm text-primary placeholder:text-primary/40 outline-none transition focus:border-primary/40 focus:bg-secondary";

type AccountDetailsModalProps = {
  onClose: () => void;
  showLogout?: boolean;
};

export function AccountDetailsModal({ onClose }: AccountDetailsModalProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfileDocument | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedData, setSavedData] = useState<FormData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    phone: "",
    address: { houseNo: "", locality: "", landmark: "", city: "", state: "", postalCode: "", country: "India" },
  });
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  useEffect(() => {
    if (!user) { setIsLoading(false); return; }

    const fetchProfile = async (): Promise<void> => {
      try {
        const doc = await readUserProfile(user.$id);
        if (!doc) throw new Error("Profile not found");
        setProfile(doc);
        const initial: FormData = {
          fullName: doc.fullName || "",
          phone: doc.phone || "",
          address: parseAddress(doc.address || ""),
        };
        setFormData(initial);
        setSavedData(initial);
        setError(null);
      } catch {
        setError("Failed to load profile");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProfile();
  }, [user]);

  const hasChanges = useMemo(() => {
    if (!savedData) return false;
    return !formEqual(formData, savedData);
  }, [formData, savedData]);

  const setAddr = (patch: Partial<AddressFields>): void =>
    setFormData((prev) => ({ ...prev, address: { ...prev.address, ...patch } }));

  const handleSave = async (): Promise<void> => {
    if (!profile || !user || !hasChanges) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateUserProfile({
        documentId: profile.$id,
        fullName: formData.fullName,
        phone: formData.phone,
        address: serializeAddress(formData.address),
      });
      setProfile(updated);
      setSavedData(formData);
      setIsEditingAddress(false);
      showActionToast({
        id: "profile-updated",
        message: "Profile updated",
        description: "Your contact and delivery details were saved.",
      });
      setTimeout(() => onClose(), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save profile";
      setError(message);
      showActionToast({ id: "profile-update-error", message, tone: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const addressIsBlank = !formData.address.houseNo && !formData.address.city && !formData.address.state;

  return (
    <div className="flex flex-col max-h-[65vh] overflow-y-auto overscroll-contain space-y-4 px-1 pb-1 sm:px-2 sm:pb-2">
      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs text-primary/60">Loading profile...</span>
          </div>
        </div>
      ) : profile ? (
        <>
          <div className="space-y-3">
            {/* Full name */}
            <div>
              <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/60 mb-1.5">Full Name</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="Your full name"
                className={INPUT_CLS}
              />
            </div>

            {/* Email — read-only */}
            <div>
              <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/60 mb-1.5">Email</label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="w-full rounded-lg border border-primary/12 bg-paper px-3 py-2.5 text-sm text-primary/45 outline-none cursor-not-allowed"
              />
              <p className="mt-1 text-[0.6rem] text-primary/45">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/60 mb-1.5">Phone Number</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Your phone number"
                className={INPUT_CLS}
              />
            </div>

            {/* Address section */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/60">Delivery Address</label>
                {!isEditingAddress && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(true)}
                    className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-primary/55 underline underline-offset-2 hover:text-primary transition"
                  >
                    {addressIsBlank ? "Add address" : "Edit"}
                  </button>
                )}
              </div>

              {!isEditingAddress ? (
                /* Read view */
                <div className="rounded-lg border border-primary/12 bg-paper px-3 py-2.5 min-h-[2.75rem]">
                  {addressIsBlank ? (
                    <p className="text-sm text-primary/38">No address saved</p>
                  ) : (
                    <p className="text-sm text-primary/80 leading-relaxed">
                      {[
                        formData.address.houseNo,
                        formData.address.locality,
                        formData.address.landmark,
                        formData.address.city,
                        formData.address.state,
                        formData.address.postalCode,
                        formData.address.country,
                      ].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                /* Edit view */
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="House / Flat No."
                    value={formData.address.houseNo}
                    onChange={(e) => setAddr({ houseNo: e.target.value })}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Locality / Area"
                    value={formData.address.locality}
                    onChange={(e) => setAddr({ locality: e.target.value })}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Landmark (optional)"
                    value={formData.address.landmark}
                    onChange={(e) => setAddr({ landmark: e.target.value })}
                    className={`${INPUT_CLS} col-span-2`}
                  />
                  <input
                    placeholder="Pincode"
                    value={formData.address.postalCode}
                    onChange={(e) => setAddr({ postalCode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="City"
                    value={formData.address.city}
                    onChange={(e) => setAddr({ city: e.target.value })}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="State"
                    value={formData.address.state}
                    onChange={(e) => setAddr({ state: e.target.value })}
                    className={INPUT_CLS}
                  />
                  <input
                    placeholder="Country"
                    value={formData.address.country}
                    onChange={(e) => setAddr({ country: e.target.value })}
                    className={`${INPUT_CLS} col-span-2`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAddr(savedData?.address ?? { houseNo: "", locality: "", landmark: "", city: "", state: "", postalCode: "", country: "India" });
                      setIsEditingAddress(false);
                    }}
                    className="col-span-2 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-primary/45 hover:text-primary/70 transition text-right mt-0.5"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-2.5">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {hasChanges && (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-4 text-xs font-semibold uppercase tracking-[0.18em] text-secondary transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                  Saving...
                </>
              ) : (
                <>
                  Save Changes
                </>
              )}
            </button>
          )}
        </>
      ) : (
        <div className="flex min-h-40 items-center justify-center">
          <p className="text-sm text-primary/60">Unable to load profile</p>
        </div>
      )}
    </div>
  );
}
