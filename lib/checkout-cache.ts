/**
 * Client-side checkout caches (localStorage).
 *
 * Two independent caches make the cart feel instant:
 *
 *  1. Profile/address cache — the signed-in user's saved shipping details, so a
 *     page reload can prefill the Amount Breakup form immediately instead of
 *     waiting for auth + the profile API. Keyed by Firebase uid and cleared on
 *     logout. The server profile (Admin SDK) stays the source of truth; this is
 *     just an optimistic display layer that we revalidate in the background.
 *
 *  2. Pincode cache — pincode → { city, state, delivery days, city type }. This
 *     mapping never changes, so once resolved we skip the India Post API call on
 *     subsequent entries of the same pincode. Not user-specific, so it persists
 *     across sessions and is never cleared on logout.
 */

export type CheckoutAddress = {
  fullName: string;
  phone: string;
  houseNo: string;
  locality: string;
  landmark: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type PincodeInfo = {
  city: string;
  state: string;
  days: string;
  cityType: "metro" | "non-metro";
};

const PROFILE_CACHE_KEY = "nt-checkout-profile-v1";
const PINCODE_CACHE_KEY = "nt-pincode-cache-v1";

type ProfileCacheShape = {
  uid: string;
  address: CheckoutAddress;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeAddress(value: unknown): CheckoutAddress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Partial<Record<keyof CheckoutAddress, unknown>>;
  return {
    fullName: str(raw.fullName),
    phone: str(raw.phone),
    houseNo: str(raw.houseNo),
    locality: str(raw.locality),
    landmark: str(raw.landmark),
    city: str(raw.city),
    state: str(raw.state),
    postalCode: str(raw.postalCode),
    country: str(raw.country) || "India",
  };
}

/** Read the cached profile address (with its owning uid), or null. */
export function readCheckoutProfileCache(): ProfileCacheShape | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { uid?: unknown; address?: unknown };
    const uid = str(parsed.uid);
    const address = normalizeAddress(parsed.address);
    if (!uid || !address) {
      return null;
    }

    return { uid, address };
  } catch {
    return null;
  }
}

/** Persist the signed-in user's shipping details for instant prefill next load. */
export function writeCheckoutProfileCache(uid: string, address: CheckoutAddress): void {
  if (typeof window === "undefined" || !uid) {
    return;
  }

  try {
    const payload: ProfileCacheShape = { uid, address };
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Storage full / disabled — non-fatal, we fall back to the API.
  }
}

/** Drop the cached profile (call on logout so the next user starts clean). */
export function clearCheckoutProfileCache(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // Non-fatal.
  }
}

function readPincodeMap(): Record<string, PincodeInfo> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(PINCODE_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed as Record<string, PincodeInfo>;
  } catch {
    return {};
  }
}

/** Look up a previously resolved pincode, or null on a miss. */
export function readPincodeCache(code: string): PincodeInfo | null {
  const entry = readPincodeMap()[code];
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const cityType = entry.cityType === "metro" ? "metro" : "non-metro";
  if (!str(entry.city) || !str(entry.state) || !str(entry.days)) {
    return null;
  }

  return { city: entry.city, state: entry.state, days: entry.days, cityType };
}

/** Cache a resolved pincode so we never hit the India Post API for it again. */
export function writePincodeCache(code: string, info: PincodeInfo): void {
  if (typeof window === "undefined" || !/^\d{6}$/.test(code)) {
    return;
  }

  try {
    const map = readPincodeMap();
    map[code] = info;
    window.localStorage.setItem(PINCODE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Non-fatal.
  }
}
