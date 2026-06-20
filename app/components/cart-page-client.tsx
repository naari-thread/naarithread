"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AuthModal } from "@/app/components/auth-modal";
import { CloudinaryImage } from "@/app/components/cloudinary-image";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import { useAuth } from "@/app/components/auth-provider";
import type { ProductRecord } from "@/lib/appwrite/products";
import {
  readCartItemSelections,
  readCartItems,
  removeCartItemSelection,
  writeCartItemSelections,
  writeCartItems,
  type CartItemSelectionsMap,
  type CartItemsMap,
} from "@/lib/cart-state";
import { readUserCartMap, upsertUserCartMap } from "@/lib/appwrite/shop-sync";
import { readUserProfile, updateUserProfile } from "@/lib/appwrite/profiles";
import {
  fetchProductsByIds,
} from "@/lib/product-catalog-cache";

// ─── Delivery estimate helpers ────────────────────────────────────────────────
const SHOP_LAT = 21.1702; // Surat, Gujarat (395002)
const SHOP_LNG = 72.8311;

const ZONE_E_STATES = new Set([
  "arunachal pradesh", "assam", "manipur", "meghalaya", "mizoram",
  "nagaland", "sikkim", "tripura", "jammu and kashmir", "ladakh",
  "andaman and nicobar islands", "andaman & nicobar islands",
  "lakshadweep",
]);

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type DeliveryEstimate = { zone: string; days: string; km: number };

function calcDeliveryEstimate(km: number, state: string): DeliveryEstimate {
  if (ZONE_E_STATES.has(state.toLowerCase().trim())) {
    return { zone: "E", days: "4–5", km };
  }
  if (km < 80) return { zone: "A", days: "1", km };
  if (km <= 500) return { zone: "B", days: "1–2", km };
  if (km <= 1400) return { zone: "C", days: "2–3", km };
  if (km <= 2500) return { zone: "D", days: "3–4", km };
  return { zone: "E", days: "4–5", km };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type CartLine = {
  product: ProductRecord;
  quantity: number;
};

type MissingCartLine = {
  productId: string;
  quantity: number;
};

type CreateOrderResponse = {
  keyId: string;
  currency: string;
  amount: number;
  razorpayOrderId: string;
  internalOrderId: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
  };
  summary: {
    subtotal: number;
    discount: number;
    couponDiscount: number;
    delivery: number;
    total: number;
  };
};

type ShippingAddressForm = {
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

type AppliedCoupon = {
  code: string;
  discountAmount: number;
  description: string;
};

type CheckoutPhase = "shopping" | "dismissed" | "error" | "success";

type SuccessInfo = {
  orderNumber: string;
  total: number;
  address: ShippingAddressForm;
  deliveryDays?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCreateOrderResponse(value: unknown): value is CreateOrderResponse {
  if (!isRecord(value) || !isRecord(value.customer) || !isRecord(value.summary)) return false;

  return (
    typeof value.keyId === "string" &&
    typeof value.currency === "string" &&
    typeof value.amount === "number" &&
    typeof value.razorpayOrderId === "string" &&
    typeof value.internalOrderId === "string" &&
    typeof value.orderNumber === "string" &&
    typeof value.customer.name === "string" &&
    typeof value.customer.email === "string" &&
    typeof value.summary.subtotal === "number" &&
    typeof value.summary.discount === "number" &&
    typeof value.summary.couponDiscount === "number" &&
    typeof value.summary.delivery === "number" &&
    typeof value.summary.total === "number"
  );
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function loadRazorpayCheckoutScript() {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// ─── Order Success Screen ────────────────────────────────────────────────────
function OrderSuccessScreen({ info }: { info: SuccessInfo }) {
  return (
    <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-16 md:pt-30">
      <section className="mx-auto w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center rounded-2xl border border-primary/15 bg-secondary p-8 text-center sm:p-10"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </span>
          <h1 className="mt-5 text-2xl font-semibold sm:text-3xl">Order Confirmed!</h1>
          <p className="mt-2 text-sm text-primary/65">
            Your order has been placed successfully.
          </p>
          <div className="mt-6 w-full rounded-xl border border-primary/12 bg-paper p-4 text-left">
            <div className="flex items-center justify-between border-b border-primary/10 pb-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/55">Order No.</span>
              <span className="text-sm font-semibold">{info.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between border-b border-primary/10 py-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/55">Amount Paid</span>
              <span className="text-sm font-semibold">{formatPrice(info.total)}</span>
            </div>
            <div className="pt-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/55">Delivering to</p>
              <p className="mt-1.5 text-sm text-primary/80">
                {info.address.fullName}
                {info.address.phone ? ` · ${info.address.phone}` : ""}
              </p>
              <p className="text-sm text-primary/65">
                {[info.address.houseNo, info.address.locality, info.address.landmark, info.address.city, info.address.state, info.address.postalCode, info.address.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>
          {info.deliveryDays && (
            <div className="mt-4 w-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
              <span className="text-xl leading-none">🚚</span>
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-emerald-800/70">Expected Delivery</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-900">
                  {info.deliveryDays} working day{info.deliveryDays === "1" ? "" : "s"}
                </p>
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-primary/50">
            To check your orders, open your profile and go to Orders.
          </p>
          <div className="mt-4 w-full">
            <Link
              href="/products"
              className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
            >
              Continue Shopping
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

// ─── Inline status banners ───────────────────────────────────────────────────
function DismissedBanner({ onRetry, onDismiss }: { onRetry: () => void; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-col gap-2.5 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <div>
            <p className="text-xs font-semibold text-amber-800">Payment window closed</p>
            <p className="text-xs text-amber-700/80">Your cart is safe. If you already paid (UPI/QR), check your orders — it may have gone through.</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 text-amber-600/70 hover:text-amber-800"
        >
          <DynamicHugeIcon name="Cancel01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2.5} />
        </button>
      </div>
      <div className="flex items-center gap-3 pl-6">
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
        >
          Try Again
        </button>
        <span className="text-xs text-amber-700/70">Check your orders from the profile menu.</span>
      </div>
    </motion.div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-red-300/60 bg-red-50 px-4 py-3"
    >
      <div className="flex items-start gap-2.5">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          <p className="text-xs font-semibold text-red-800">Payment failed</p>
          <p className="text-xs text-red-700/80">{message}</p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 text-red-500/70 hover:text-red-700"
      >
        <DynamicHugeIcon name="Cancel01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2.5} />
      </button>
    </motion.div>
  );
}

export function CartPageClient() {
  const { user, isLoading, isAuthenticated, createAuthJwt } = useAuth();
  const [cartItems, setCartItems] = useState<CartItemsMap>({});
  const [cartSelections, setCartSelections] = useState<CartItemSelectionsMap>({});
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [hasCompletedCatalogSync, setHasCompletedCatalogSync] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>("shopping");
  const [checkoutError, setCheckoutError] = useState("");
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);
  const [pendingOrder, setPendingOrder] = useState<CreateOrderResponse | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>({
    fullName: "",
    phone: "",
    houseNo: "",
    locality: "",
    landmark: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });
  const [profileDocId, setProfileDocId] = useState<string>("");
  const [postalLookupPending, setPostalLookupPending] = useState(false);
  const [postalLookupFailed, setPostalLookupFailed] = useState(false);
  const [deliveryEstimate, setDeliveryEstimate] = useState<DeliveryEstimate | null>(null);
  const [saveAddress, setSaveAddress] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [isMobileCheckoutOpen, setIsMobileCheckoutOpen] = useState(false);

  const handleProceedToBuyRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCartItems(readCartItems());
      setCartSelections(readCartItemSelections());
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  // Reset form only when switching between two different logged-in users.
  // Ignore null transitions (brief session re-validation on focus) to prevent
  // the form from clearing when the user takes a screenshot or tab switches.
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    const nextId = user?.$id ?? null;
    const prevId = prevUserIdRef.current;
    if (nextId !== null) {
      if (prevId !== null && prevId !== nextId) {
        setShippingAddress({
          fullName: "",
          phone: "",
          houseNo: "",
          locality: "",
          landmark: "",
          city: "",
          state: "",
          postalCode: "",
          country: "India",
        });
        setDeliveryEstimate(null);
        setPostalLookupFailed(false);
      }
      prevUserIdRef.current = nextId;
    }
  }, [user?.$id]);

  // Prefill shipping form from saved profile.
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setProfileDocId("");
      return;
    }

    let alive = true;

    (async () => {
      const profile = await readUserProfile(user.$id);
      if (!alive || !profile) {
        return;
      }

      setProfileDocId(profile.$id);

      let savedAddress: Partial<ShippingAddressForm> = {};
      if (profile.address) {
        try {
          const parsed = JSON.parse(profile.address) as Partial<ShippingAddressForm>;
          if (parsed && typeof parsed === "object") {
            savedAddress = parsed;
          }
        } catch {
          savedAddress = { houseNo: profile.address };
        }
      }

      setShippingAddress({
        fullName: savedAddress.fullName || profile.fullName || user.name || "",
        phone: savedAddress.phone || profile.phone || "",
        houseNo: savedAddress.houseNo || "",
        locality: savedAddress.locality || "",
        landmark: savedAddress.landmark || "",
        city: savedAddress.city || "",
        state: savedAddress.state || "",
        postalCode: savedAddress.postalCode || "",
        country: savedAddress.country || "India",
      });
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user]);

  // Postal code → city + state autofill + delivery estimate.
  useEffect(() => {
    const code = shippingAddress.postalCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setPostalLookupFailed(false);
      setDeliveryEstimate(null);
      return;
    }

    let alive = true;
    setPostalLookupPending(true);
    setPostalLookupFailed(false);
    setDeliveryEstimate(null);

    const timer = setTimeout(async () => {
      try {
        // 1. India Post API — city/state autofill
        const postalRes = await fetch(`https://api.postalpincode.in/pincode/${code}`);
        const postalData = (await postalRes.json()) as Array<{
          Status: string;
          PostOffice?: Array<{ District: string; State: string }>;
        }>;

        if (!alive) return;

        let detectedState = "";
        if (postalData[0]?.Status === "Success" && postalData[0]?.PostOffice?.length) {
          const po = postalData[0].PostOffice[0];
          detectedState = po.State;
          setShippingAddress((prev) => ({
            ...prev,
            city: prev.city || po.District,
            state: prev.state || po.State,
          }));
        } else {
          if (alive) setPostalLookupFailed(true);
        }

        // 2. Nominatim geocoding — lat/lng for distance → zone estimate
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${code}&country=India&format=json&limit=1`,
            { headers: { "User-Agent": "NaariThread/1.0 (naarithread@gmail.com)" } }
          );
          const geoData = (await geoRes.json()) as Array<{ lat: string; lon: string }>;
          if (!alive) return;
          if (geoData[0]) {
            const km = haversineKm(SHOP_LAT, SHOP_LNG, parseFloat(geoData[0].lat), parseFloat(geoData[0].lon));
            setDeliveryEstimate(calcDeliveryEstimate(Math.round(km), detectedState));
          }
        } catch {
          // Geocoding failure is non-fatal — city/state already autofilled above
        }
      } catch {
        if (alive) setPostalLookupFailed(true);
      } finally {
        if (alive) setPostalLookupPending(false);
      }
    }, 600);

    return () => {
      alive = false;
      clearTimeout(timer);
      setPostalLookupPending(false);
    };
  }, [shippingAddress.postalCode]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    // Fetch only the products that are in the cart by their exact IDs.
    // Using the general catalog endpoint (limit=12) would incorrectly flag
    // products from page 2+ as "stale" and auto-remove them.
    const hydrateCartProducts = async () => {
      const cartIds = Object.keys(readCartItems());

      if (cartIds.length === 0) {
        if (alive) setHasCompletedCatalogSync(true);
        return;
      }

      try {
        const serverProducts = await fetchProductsByIds(cartIds, controller.signal);
        if (!alive) return;
        // serverProducts contains exactly what Firestore returned for these IDs.
        // Any cartId absent from the response genuinely doesn't exist anymore.
        if (serverProducts.length > 0) {
          setProducts(serverProducts);
        }
      } catch {
        // On fetch error, don't flag anything as stale.
      } finally {
        if (alive) setHasCompletedCatalogSync(true);
      }
    };

    void hydrateCartProducts();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const hydrateFromCloud = async () => {
      if (!isAuthenticated || !user?.$id) {
        return;
      }

      try {
        const jwt = await createAuthJwt();
        const cloudCart = await readUserCartMap(jwt, user.$id);
        if (!alive || Object.keys(cloudCart).length === 0) {
          return;
        }

        const merged = { ...cloudCart, ...readCartItems() };
        writeCartItems(merged);
        setCartItems(merged);
      } catch {
        // Local cart remains source of truth on temporary sync failure.
      }
    };

    void hydrateFromCloud();

    return () => {
      alive = false;
    };
  }, [createAuthJwt, isAuthenticated, user?.$id]);

  // Auto-remove stale cart entries (IDs not in the catalog) once the catalog
  // finishes loading. Silently clears leftover dev/test data without scaring
  // the user with "Product unavailable" error cards.
  useEffect(() => {
    if (!hasCompletedCatalogSync || products.length === 0) return;

    const byId = new Set(products.map((p) => p.id));
    const staleIds = Object.keys(cartItems).filter((id) => !byId.has(id));
    if (staleIds.length === 0) return;

    const next = { ...cartItems };
    for (const id of staleIds) {
      delete next[id];
    }

    setCartItems(next);
    writeCartItems(next);

    toast.info(
      staleIds.length === 1
        ? "1 item was removed from your cart (no longer available)."
        : `${staleIds.length} items were removed from your cart (no longer available).`
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompletedCatalogSync]);

  const { lines, missingLines } = useMemo(() => {
    const byId = new Map(products.map((item) => [item.id, item] as const));
    const resolvedLines: CartLine[] = [];
    const unresolvedLines: MissingCartLine[] = [];

    for (const [productId, quantity] of Object.entries(cartItems)) {
      if (quantity <= 0) {
        continue;
      }

      const product = byId.get(productId);
      if (!product) {
        unresolvedLines.push({ productId, quantity });
        continue;
      }

      resolvedLines.push({
        product,
        quantity,
      });
    }

    return {
      lines: resolvedLines,
      missingLines: unresolvedLines,
    };
  }, [cartItems, products]);

  const subtotal = lines.reduce((total, line) => {
    const sellingPrice = line.product.discountPrice > 0 ? line.product.discountPrice : line.product.originalPrice;
    return total + sellingPrice * line.quantity;
  }, 0);

  const originalTotal = lines.reduce((total, line) => total + line.product.originalPrice * line.quantity, 0);
  const productDiscount = Math.max(0, originalTotal - subtotal);
  const delivery = lines.length === 0 || subtotal > 2999 ? 0 : 99;
  const couponDiscount = Math.min(appliedCoupon?.discountAmount ?? 0, subtotal);
  const total = Math.max(0, subtotal - couponDiscount) + delivery;

  const persistCart = async (nextItems: CartItemsMap) => {
    setCartItems(nextItems);
    writeCartItems(nextItems);

    if (!isAuthenticated || !user?.$id) {
      return;
    }

    try {
      const jwt = await createAuthJwt();
      await upsertUserCartMap(jwt, user.$id, nextItems);
    } catch {
      // Keep local updates responsive if cloud write fails.
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    const next = { ...cartItems };
    const normalized = Math.max(0, Math.min(99, Math.trunc(quantity)));
    const previousQuantity = cartItems[productId] ?? 0;

    if (normalized <= 0) {
      delete next[productId];
      removeCartItemSelection(productId);
      setCartSelections((previous) => {
        const rest = { ...previous };
        delete rest[productId];
        return rest;
      });
    } else {
      next[productId] = normalized;
    }

    await persistCart(next);

    if (previousQuantity > 0 && normalized <= 0) {
      const productName = products.find((product) => product.id === productId)?.name ?? "Item";
      toast.info("Removed from cart", {
        id: `cart-removed-${productId}`,
        description: productName,
      });
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || couponLoading) return;

    if (!isAuthenticated) {
      toast.info("Sign in to apply coupons.");
      setIsAuthModalOpen(true);
      return;
    }

    setCouponLoading(true);
    setCouponError("");
    setAppliedCoupon(null);

    try {
      const jwt = await createAuthJwt();
      const res = await fetch("/api/cart/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ code: couponCode.trim(), subtotal }),
      });

      const data = (await res.json()) as {
        valid: boolean;
        message: string;
        discountAmount?: number;
        code?: string;
        description?: string;
      };

      if (data.valid && data.discountAmount !== undefined) {
        setAppliedCoupon({ code: data.code!, discountAmount: data.discountAmount, description: data.description! });
        toast.success(data.message);
      } else {
        const message = data.message || "Invalid coupon code.";
        setCouponError(message);
        toast.error(message, { id: "coupon-invalid" });
      }
    } catch {
      const message = "Unable to validate coupon right now.";
      setCouponError(message);
      toast.error(message, { id: "coupon-validation-error" });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleProceedToBuy = async () => {
    if (lines.length === 0 || isProcessingCheckout) {
      return;
    }

    if (!isAuthenticated) {
      setIsAuthModalOpen(true);
      toast.info("Sign in to continue with secure checkout.");
      return;
    }

    const hasShippingDetails =
      shippingAddress.fullName.trim() &&
      shippingAddress.phone.trim() &&
      shippingAddress.houseNo.trim() &&
      shippingAddress.locality.trim() &&
      shippingAddress.city.trim() &&
      shippingAddress.state.trim() &&
      shippingAddress.postalCode.trim() &&
      shippingAddress.country.trim();

    if (!hasShippingDetails) {
      toast.error("Please complete shipping address before payment.");
      return;
    }

    setCheckoutPhase("shopping");
    setCheckoutError("");
    setIsProcessingCheckout(true);

    // Save address immediately on "Proceed to Buy" — don't wait for payment outcome.
    if (saveAddress && profileDocId) {
      void updateUserProfile({
        documentId: profileDocId,
        fullName: shippingAddress.fullName.trim() || user?.name || "",
        phone: shippingAddress.phone.trim(),
        address: JSON.stringify(shippingAddress),
      });
    }

    try {
      const jwt = await createAuthJwt();

      const orderBody = JSON.stringify({
        lines: lines.map((line) => ({
          productId: line.product.id,
          quantity: line.quantity,
          size: cartSelections[line.product.id]?.size ?? "",
          color: cartSelections[line.product.id]?.color ?? "",
        })),
        shippingAddress,
        couponCode: appliedCoupon?.code ?? "",
      });

      const orderResponse = pendingOrder
        ? await fetch("/api/account/orders/retry-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
            body: JSON.stringify({ orderId: pendingOrder.internalOrderId }),
          })
        : await fetch("/api/payments/razorpay/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: orderBody,
        });

      const responsePayload: unknown = await orderResponse.json();
      const orderPayload = pendingOrder
        ? {
            ...pendingOrder,
            ...(isRecord(responsePayload) ? responsePayload : {}),
            summary: pendingOrder.summary,
            orderNumber: pendingOrder.orderNumber,
          }
        : responsePayload;

      if (!orderResponse.ok || !isCreateOrderResponse(orderPayload)) {
        const message = isRecord(responsePayload) && typeof responsePayload.error === "string"
          ? responsePayload.error
          : "Unable to create payment order.";
        throw new Error(message);
      }

      setPendingOrder(orderPayload);

      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout. Please try again.");
      }

      const serverTotal = orderPayload.summary?.total ?? total;
      const currentInternalOrderId = orderPayload.internalOrderId;

      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: Number(orderPayload.amount ?? 0),
        currency: orderPayload.currency ?? "INR",
        name: "NaariThread",
        description: "Secure checkout",
        order_id: orderPayload.razorpayOrderId,
        prefill: {
          name: orderPayload.customer?.name ?? shippingAddress.fullName,
          email: orderPayload.customer?.email ?? "",
          contact: shippingAddress.phone,
        },
        retry: {
          enabled: true,
          max_count: 2,
        },
        notes: {
          internalOrderId: currentInternalOrderId,
        },
        theme: {
          color: "#2B1A1A",
        },
        modal: {
          ondismiss: async () => {
            setIsProcessingCheckout(false);
            // For async payment methods (UPI QR), the bank deducts before
            // Razorpay confirms to the SDK. Check the actual order status
            // before assuming the user cancelled.
            try {
              const checkJwt = await createAuthJwt();
              const statusRes = await fetch("/api/account/orders", {
                headers: { Authorization: `Bearer ${checkJwt}` },
              });
              if (statusRes.ok) {
                const statusData = (await statusRes.json()) as { orders?: Array<{ id: string; status: string; paymentStatus: string; totalAmount: number; orderNumber: string }> };
                const thisOrder = statusData.orders?.find((o) => o.id === currentInternalOrderId);
                if (thisOrder && (thisOrder.paymentStatus === "paid" || thisOrder.status === "placed" || thisOrder.status === "completed")) {
                  // Payment confirmed server-side — show success even though handler never fired.
                  writeCartItems({});
                  writeCartItemSelections({});
                  setCartItems({});
                  setCartSelections({});
                  setSuccessInfo({
                    orderNumber: thisOrder.orderNumber,
                    total: thisOrder.totalAmount,
                    address: { ...shippingAddress },
                    deliveryDays: deliveryEstimate?.days,
                  });
                  setCheckoutPhase("success");
                  setPendingOrder(null);
                  return;
                }
              }
            } catch {
              // Fall through to cancelled state if check fails.
            }
            try {
              const cancelJwt = await createAuthJwt();
              await fetch("/api/payments/razorpay/cancel-order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${cancelJwt}`,
                },
                body: JSON.stringify({ orderId: currentInternalOrderId }),
              });
            } catch {
              // Keep the same in-memory order available for retry if cancellation sync fails.
            }
            setCheckoutPhase("dismissed");
          },
          confirm_close: true,
          escape: true,
          backdropclose: false,
        },
        handler: async (paymentResult) => {
          try {
            const verifyResponse = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${jwt}`,
              },
              body: JSON.stringify({
                internalOrderId: orderPayload.internalOrderId,
                ...paymentResult,
              }),
            });

            const verifyPayload = (await verifyResponse.json()) as { error?: string; paymentState?: string };
            if (!verifyResponse.ok || verifyPayload.paymentState !== "paid") {
              throw new Error(verifyPayload.error ?? "Payment verification failed.");
            }


            writeCartItems({});
            writeCartItemSelections({});
            setCartItems({});
            setCartSelections({});
            setAppliedCoupon(null);
            setCouponCode("");
            setPendingOrder(null);

            setSuccessInfo({
              orderNumber: orderPayload.orderNumber ?? "",
              total: serverTotal,
              address: { ...shippingAddress },
              deliveryDays: deliveryEstimate?.days,
            });
            setCheckoutPhase("success");
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Unable to confirm payment right now.";
            setCheckoutError(msg);
            setCheckoutPhase("error");
          }
        },
      });

      checkout.open();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unable to start checkout.";
      setCheckoutError(msg);
      setCheckoutPhase("error");
      setIsProcessingCheckout(false);
    }
  };

  // Capture latest version of handleProceedToBuy for the "Try Again" button.
  handleProceedToBuyRef.current = handleProceedToBuy;

  // ─── Success screen ──────────────────────────────────────────────────────
  if (checkoutPhase === "success" && successInfo) {
    return (
      <>
        <OrderSuccessScreen info={successInfo} />
        <AuthModal
          open={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          title="Sign up / Login"
          description="Use a secure email link to sync and protect your cart across devices."
        />
      </>
    );
  }

  return (
    <>
      {/* Payment processing overlay — blocks all interactions during server-side verification */}
      {isProcessingCheckout && (
        <div className="fixed inset-0 z-[98] flex flex-col items-center justify-center bg-paper/95 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 px-8 text-center">
            <div className="relative size-14">
              <span className="absolute inset-0 rounded-full border-2 border-primary/12" />
              <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/70 motion-safe:animate-spin [animation-duration:900ms]" />
              <span className="absolute inset-[5px] rounded-full border border-transparent border-b-primary/35 motion-safe:animate-spin [animation-duration:1400ms] [animation-direction:reverse]" />
            </div>
            <div>
              <p className="text-base font-semibold text-primary">Processing your payment</p>
              <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-primary/60">
                Do not press back or close this tab. We are confirming your order — this takes a few seconds.
              </p>
            </div>
          </div>
        </div>
      )}
      <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-16 md:pt-30">
        <section className="mx-auto w-full max-w-6xl">
          <header className="pb-6 border-b border-primary/15">
            <h1 className="text-3xl font-semibold sm:text-4xl">Cart</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary/65">
              Review your selected items and proceed with secure checkout.
            </p>
          </header>

          {/* No banner for unauthenticated users — checkout sidebar handles the sign-in gate */}

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_480px] lg:items-start lg:gap-10">
            {/* ─── Cart items ──────────────────────────────────── */}
            <div className="flex flex-col">
              {lines.length === 0 && missingLines.length === 0 ? (
                <div className="py-12 text-center text-sm text-primary/75">
                  Your cart is empty. Add products from the catalog to continue.
                </div>
              ) : null}

              {lines.map((line) => {
                const sellingPrice =
                  line.product.discountPrice > 0 ? line.product.discountPrice : line.product.originalPrice;

                return (
                  <article
                    key={line.product.id}
                    className="flex flex-col gap-6 border-b border-primary/10 py-6 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-1 items-start sm:items-center gap-5">
                      <Link
                        href={`/products/${line.product.category}/${line.product.subCategory}/${line.product.slug}`}
                        className="relative h-28 w-24 sm:h-32 sm:w-28 shrink-0 overflow-hidden rounded-xl bg-primary/5 transition hover:opacity-90"
                      >
                        {line.product.mainImageUrl ? (
                          <CloudinaryImage
                            src={line.product.mainImageUrl}
                            alt={line.product.name}
                            fill
                            sizes="(max-width: 768px) 112px, 112px"
                            className="object-cover object-top"
                          />
                        ) : null}
                      </Link>

                      <div className="flex flex-col">
                        <Link
                          href={`/products/${line.product.category}/${line.product.subCategory}/${line.product.slug}`}
                          className="hover:underline"
                        >
                          <h2 className="text-base font-semibold sm:text-lg">{line.product.name}</h2>
                        </Link>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-primary/65">
                          {line.product.categoryValue} • {line.product.subCategoryValue}
                        </p>
                        {cartSelections[line.product.id]?.size || cartSelections[line.product.id]?.color ? (
                          <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.13em] text-primary/60">
                            {cartSelections[line.product.id]?.size
                              ? `Size: ${cartSelections[line.product.id]?.size}`
                              : ""}
                            {cartSelections[line.product.id]?.size && cartSelections[line.product.id]?.color
                              ? "  •  "
                              : ""}
                            {cartSelections[line.product.id]?.color
                              ? `Color: ${cartSelections[line.product.id]?.color}`
                              : ""}
                          </p>
                        ) : null}

                        <div className="mt-3 flex items-baseline gap-2">
                          <span className="text-base font-semibold">₹{sellingPrice.toLocaleString("en-IN")}</span>
                          {line.product.originalPrice > sellingPrice && (
                            <span className="text-xs text-primary/55 line-through">
                              ₹{line.product.originalPrice.toLocaleString("en-IN")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center gap-3 sm:w-40 shrink-0 sm:gap-4">
                      <div className="flex h-10 items-center justify-between gap-2 rounded-full border border-primary/20 px-2 bg-primary/5 w-full">
                        <button
                          type="button"
                          aria-label={`Decrease ${line.product.name} quantity`}
                          onClick={() => void updateQuantity(line.product.id, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-primary/10"
                        >
                          <DynamicHugeIcon name="Remove01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden={true} />
                        </button>
                        <span className="text-sm font-semibold w-6 text-center">{line.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${line.product.name} quantity`}
                          disabled={line.quantity >= line.product.stockQty}
                          onClick={() => void updateQuantity(line.product.id, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-primary/10 disabled:opacity-30"
                        >
                          <DynamicHugeIcon name="Add01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden={true} />
                        </button>
                      </div>
                      {line.product.stockQty <= 3 && (
                        <p className="text-[0.62rem] font-semibold text-red-600">
                          Only {line.product.stockQty} left in stock!
                        </p>
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${line.product.name} from cart`}
                        onClick={() => void updateQuantity(line.product.id, 0)}
                        className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-primary/20 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}

              {missingLines.map((line) =>
                hasCompletedCatalogSync ? (
                  <article key={line.productId} className="flex flex-col gap-4 border-b border-primary/10 py-6">
                    <div className="rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
                      <p className="text-sm font-medium text-primary">Product unavailable</p>
                      <p className="mt-1 text-xs text-primary/70">
                        This item could not be loaded right now. You can remove it from your cart.
                      </p>
                      <p className="mt-2 text-xs text-primary/70">Quantity: {line.quantity}</p>
                      <button
                        type="button"
                        aria-label="Remove unavailable item from cart"
                        onClick={() => void updateQuantity(line.productId, 0)}
                        className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-primary/20 px-4 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ) : (
                  <article
                    key={line.productId}
                    className="flex flex-col gap-6 border-b border-primary/10 py-6"
                    aria-hidden={true}
                  >
                    <div className="flex flex-1 items-start gap-5">
                      <div className="h-28 w-24 shrink-0 animate-pulse rounded-xl bg-primary/10 sm:h-32 sm:w-28" />
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-primary/10" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-primary/10" />
                        <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-primary/10" />
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>

            {/* ─── Order summary sidebar — hidden on mobile, visible on desktop ── */}
            <aside className="relative hidden rounded-2xl border border-primary/15 bg-secondary p-5 sm:p-6 lg:block lg:sticky lg:top-28 lg:self-start">
              <h3 className="text-lg font-semibold">Amount Breakup</h3>

              {/* Shipping address */}
              <div className="mt-5 rounded-xl border border-primary/12 bg-paper p-3.5 sm:p-4">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">
                  Shipping Address
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  {/* Full name | Phone */}
                  <input
                    aria-label="Shipping full name"
                    placeholder="Full name"
                    value={shippingAddress.fullName}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, fullName: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  <input
                    aria-label="Shipping phone"
                    placeholder="Phone"
                    value={shippingAddress.phone}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, phone: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* House no | Locality */}
                  <input
                    aria-label="House / flat number"
                    placeholder="House / Flat No."
                    value={shippingAddress.houseNo}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, houseNo: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  <input
                    aria-label="Locality / area"
                    placeholder="Locality / Area"
                    value={shippingAddress.locality}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, locality: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Landmark — full width */}
                  <input
                    aria-label="Landmark (optional)"
                    placeholder="Landmark (optional)"
                    value={shippingAddress.landmark}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, landmark: event.target.value }))
                    }
                    className="col-span-2 h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Pincode — full width, has autofill spinner */}
                  <div className="relative col-span-2">
                    <input
                      aria-label="Shipping postal code"
                      placeholder="Pincode — auto-fills city & state"
                      maxLength={6}
                      value={shippingAddress.postalCode}
                      onChange={(event) => {
                        const val = event.target.value.replace(/\D/g, "").slice(0, 6);
                        setShippingAddress((prev) => ({
                          ...prev,
                          postalCode: val,
                          city: val.length === 6 ? "" : prev.city,
                          state: val.length === 6 ? "" : prev.state,
                        }));
                      }}
                      className="h-10 w-full rounded-lg border border-primary/16 bg-secondary px-3 pr-8 text-sm outline-none transition focus:border-primary/45"
                    />
                    {postalLookupPending ? (
                      <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary/60" />
                      </span>
                    ) : null}
                  </div>
                  {postalLookupFailed && (
                    <p className="col-span-2 text-xs text-amber-700">
                      Pincode not found — please fill in City and State manually.
                    </p>
                  )}
                  {deliveryEstimate && !postalLookupPending && (
                    <div className="col-span-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <span className="text-base leading-none">🚚</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-emerald-800">
                          Est. delivery in {deliveryEstimate.days} working day{deliveryEstimate.days === "1" ? "" : "s"}
                        </p>
                        <p className="text-[0.68rem] text-emerald-700/70">Indicative estimate based on your location</p>
                      </div>
                    </div>
                  )}
                  {/* City | State */}
                  <input
                    aria-label="Shipping city"
                    placeholder="City"
                    value={shippingAddress.city}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, city: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  <input
                    aria-label="Shipping state"
                    placeholder="State"
                    value={shippingAddress.state}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, state: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Country — full width */}
                  <input
                    aria-label="Shipping country"
                    placeholder="Country"
                    value={shippingAddress.country}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, country: event.target.value }))
                    }
                    className="col-span-2 h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Save-for-later checkbox */}
                  {isAuthenticated &&
                  (shippingAddress.fullName || shippingAddress.phone || shippingAddress.houseNo || shippingAddress.city) ? (
                    <label className="col-span-2 flex cursor-pointer items-center gap-2.5 pt-0.5">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="h-4 w-4 rounded border-primary/30 accent-primary"
                      />
                      <span className="text-xs text-primary/65">Save delivery details for next time</span>
                    </label>
                  ) : null}
                </div>
              </div>

              {/* Coupon code */}
              <div className="mt-4">
                <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">
                  Coupon Code
                </p>
                {appliedCoupon ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-xl border border-green-300/60 bg-green-50 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-xs font-semibold text-green-800">{appliedCoupon.code}</p>
                      <p className="text-xs text-green-700/80">{appliedCoupon.description} applied</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove coupon"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                        setCouponError("");
                        toast.info("Coupon removed", { id: "coupon-removed" });
                      }}
                      className="ml-2 text-green-600/70 hover:text-green-800"
                    >
                      <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2.5} />
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      aria-label="Coupon code"
                      placeholder="Enter coupon code"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value.toUpperCase());
                        setCouponError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleApplyCoupon();
                        }
                      }}
                      className="h-10 flex-1 rounded-lg border border-primary/16 bg-paper px-3 text-sm uppercase tracking-wide outline-none transition focus:border-primary/45"
                    />
                    <button
                      type="button"
                      onClick={() => void handleApplyCoupon()}
                      disabled={couponLoading || !couponCode.trim()}
                      aria-label="Apply coupon"
                      className="inline-flex h-10 items-center justify-center rounded-lg border border-primary/22 px-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80 transition hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {couponLoading ? "…" : "Apply"}
                    </button>
                  </div>
                )}
                {couponError ? (
                  <p className="mt-1.5 text-xs text-red-600">{couponError}</p>
                ) : null}
              </div>

              {/* Price breakdown */}
              <div className="mt-5 space-y-2.5 border-t border-primary/12 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-primary/75">Subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {productDiscount > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-primary/75">Product discount</span>
                    <span className="text-green-700">- {formatPrice(productDiscount)}</span>
                  </div>
                ) : null}
                {couponDiscount > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="text-primary/75">
                      Coupon{appliedCoupon ? ` (${appliedCoupon.code})` : ""}
                    </span>
                    <span className="text-green-700">- {formatPrice(couponDiscount)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-primary/75">Delivery</span>
                  <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-primary/12 pt-4">
                <span className="text-base font-semibold">Total</span>
                <span className="text-xl font-semibold">{formatPrice(total)}</span>
              </div>

              {/* Checkout state banners */}
              <div className="mt-4">
                {checkoutPhase === "dismissed" ? (
                  <DismissedBanner
                    onRetry={() => void handleProceedToBuy()}
                    onDismiss={() => {
                      setPendingOrder(null);
                      setCheckoutPhase("shopping");
                    }}
                  />
                ) : null}
                {checkoutPhase === "error" ? (
                  <ErrorBanner
                    message={checkoutError || "Something went wrong. Please try again."}
                    onDismiss={() => setCheckoutPhase("shopping")}
                  />
                ) : null}
              </div>

              <button
                type="button"
                aria-label="Proceed to buy"
                onClick={() => void handleProceedToBuy()}
                disabled={lines.length === 0 || isProcessingCheckout}
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessingCheckout ? "Processing..." : "Proceed to Buy"}
              </button>

              {delivery > 0 ? (
                <p className="mt-3 text-center text-[0.67rem] text-primary/50">
                  Free delivery on orders above ₹2,999
                </p>
              ) : null}

              {/* ── Sign-in gate overlay ── */}
              {!isLoading && !isAuthenticated ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-end rounded-2xl"
                  style={{
                    background: "linear-gradient(to top, var(--color-secondary, #fdf6ee) 55%, transparent 100%)",
                  }}
                >
                  <div className="flex w-full flex-col items-center gap-3 px-6 pb-7 pt-12 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/18 bg-paper">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary/60" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-primary">Sign in to checkout</p>
                      <p className="mt-1 text-xs leading-relaxed text-primary/60">
                        Create an account or sign in to place your order securely.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
                    >
                      Sign in / Create Account
                    </button>
                    <p className="text-[0.65rem] text-primary/45">Free · No spam · Secure email link</p>
                  </div>
                </motion.div>
              ) : null}
            </aside>
          </div>
        </section>
      </main>

      {/* Mobile sticky checkout bar — above bottom nav, hidden on desktop */}
      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-[85] px-3 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-primary/15 bg-secondary/96 px-4 py-3 shadow-[0_-6px_24px_rgba(42,15,15,0.12)] backdrop-blur-md">
            <div className="min-w-0 flex-1">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-primary/50">Total</p>
              <p className="text-base font-semibold text-primary">{formatPrice(total)}</p>
            </div>
            <button
              type="button"
              aria-label="Open order summary and proceed to checkout"
              onClick={() => setIsMobileCheckoutOpen(true)}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-primary bg-primary px-5 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
            >
              Proceed to Checkout
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile Amount Breakup bottom sheet */}
      <AnimatePresence>
        {isMobileCheckoutOpen ? (
          <>
            <motion.div
              key="mobile-checkout-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[90] bg-primary/30 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
              onClick={() => setIsMobileCheckoutOpen(false)}
            />
            <motion.div
              key="mobile-checkout-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 40, mass: 0.8 }}
              className="fixed inset-x-0 bottom-0 z-[91] flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border-t border-primary/15 bg-secondary shadow-[0_-20px_60px_rgba(42,15,15,0.22)] lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Order summary"
            >
              {/* Sheet header */}
              <div className="flex shrink-0 items-center justify-between border-b border-primary/10 px-5 py-4">
                <h3 className="text-base font-semibold">Amount Breakup</h3>
                <button
                  type="button"
                  aria-label="Close order summary"
                  onClick={() => setIsMobileCheckoutOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/18 bg-paper text-primary transition hover:border-primary/35"
                >
                  <span className="relative h-3 w-3">
                    <span className="absolute left-0 top-[5px] block h-[1.5px] w-3 rotate-45 rounded-full bg-current" />
                    <span className="absolute left-0 top-[5px] block h-[1.5px] w-3 -rotate-45 rounded-full bg-current" />
                  </span>
                </button>
              </div>

              {/* Scrollable content */}
              <div className="relative flex-1 overflow-y-auto p-5 pb-10">

                {/* Shipping address */}
                <div className="rounded-xl border border-primary/12 bg-paper p-3.5">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">
                    Shipping Address
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <input aria-label="Shipping full name" placeholder="Full name" value={shippingAddress.fullName}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, fullName: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="Shipping phone" placeholder="Phone" value={shippingAddress.phone}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, phone: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="House / flat number" placeholder="House / Flat No." value={shippingAddress.houseNo}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, houseNo: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="Locality / area" placeholder="Locality / Area" value={shippingAddress.locality}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, locality: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="Landmark (optional)" placeholder="Landmark (optional)" value={shippingAddress.landmark}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, landmark: e.target.value }))}
                      className="col-span-2 h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <div className="relative col-span-2">
                      <input aria-label="Shipping postal code" placeholder="Pincode — auto-fills city & state"
                        maxLength={6} value={shippingAddress.postalCode}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setShippingAddress((p) => ({ ...p, postalCode: val, city: val.length === 6 ? "" : p.city, state: val.length === 6 ? "" : p.state }));
                        }}
                        className="h-10 w-full rounded-lg border border-primary/16 bg-secondary px-3 pr-8 text-sm outline-none transition focus:border-primary/45" />
                      {postalLookupPending ? (
                        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary/60" />
                        </span>
                      ) : null}
                    </div>
                    {postalLookupFailed ? (
                      <p className="col-span-2 text-xs text-amber-700">Pincode not found — please fill in City and State manually.</p>
                    ) : null}
                    {deliveryEstimate && !postalLookupPending ? (
                      <div className="col-span-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                        <span className="text-base leading-none">🚚</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-emerald-800">Est. delivery in {deliveryEstimate.days} working day{deliveryEstimate.days === "1" ? "" : "s"}</p>
                          <p className="text-[0.68rem] text-emerald-700/70">Indicative estimate based on your location</p>
                        </div>
                      </div>
                    ) : null}
                    <input aria-label="Shipping city" placeholder="City" value={shippingAddress.city}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, city: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="Shipping state" placeholder="State" value={shippingAddress.state}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, state: e.target.value }))}
                      className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    <input aria-label="Shipping country" placeholder="Country" value={shippingAddress.country}
                      onChange={(e) => setShippingAddress((p) => ({ ...p, country: e.target.value }))}
                      className="col-span-2 h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45" />
                    {isAuthenticated && (shippingAddress.fullName || shippingAddress.phone || shippingAddress.houseNo || shippingAddress.city) ? (
                      <label className="col-span-2 flex cursor-pointer items-center gap-2.5 pt-0.5">
                        <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)}
                          className="h-4 w-4 rounded border-primary/30 accent-primary" />
                        <span className="text-xs text-primary/65">Save delivery details for next time</span>
                      </label>
                    ) : null}
                  </div>
                </div>

                {/* Coupon code */}
                <div className="mt-4">
                  <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">Coupon Code</p>
                  {appliedCoupon ? (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between rounded-xl border border-green-300/60 bg-green-50 px-3.5 py-2.5">
                      <div>
                        <p className="text-xs font-semibold text-green-800">{appliedCoupon.code}</p>
                        <p className="text-xs text-green-700/80">{appliedCoupon.description} applied</p>
                      </div>
                      <button type="button" aria-label="Remove coupon"
                        onClick={() => { setAppliedCoupon(null); setCouponCode(""); setCouponError(""); toast.info("Coupon removed", { id: "coupon-removed" }); }}
                        className="ml-2 text-green-600/70 hover:text-green-800">
                        <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2.5} />
                      </button>
                    </motion.div>
                  ) : (
                    <div className="flex gap-2">
                      <input aria-label="Coupon code" placeholder="Enter coupon code" value={couponCode}
                        onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleApplyCoupon(); } }}
                        className="h-10 flex-1 rounded-lg border border-primary/16 bg-paper px-3 text-sm uppercase tracking-wide outline-none transition focus:border-primary/45" />
                      <button type="button" onClick={() => void handleApplyCoupon()} disabled={couponLoading || !couponCode.trim()} aria-label="Apply coupon"
                        className="inline-flex h-10 items-center justify-center rounded-lg border border-primary/22 px-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80 transition hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-45">
                        {couponLoading ? "…" : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError ? <p className="mt-1.5 text-xs text-red-600">{couponError}</p> : null}
                </div>

                {/* Price breakdown */}
                <div className="mt-5 space-y-2.5 border-t border-primary/12 pt-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-primary/75">Subtotal</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  {productDiscount > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-primary/75">Product discount</span>
                      <span className="text-green-700">- {formatPrice(productDiscount)}</span>
                    </div>
                  ) : null}
                  {couponDiscount > 0 ? (
                    <div className="flex items-center justify-between">
                      <span className="text-primary/75">Coupon{appliedCoupon ? ` (${appliedCoupon.code})` : ""}</span>
                      <span className="text-green-700">- {formatPrice(couponDiscount)}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-primary/75">Delivery</span>
                    <span>{delivery === 0 ? "Free" : formatPrice(delivery)}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-primary/12 pt-4">
                  <span className="text-base font-semibold">Total</span>
                  <span className="text-xl font-semibold">{formatPrice(total)}</span>
                </div>

                {/* Checkout state banners */}
                <div className="mt-4">
                  {checkoutPhase === "dismissed" ? (
                    <DismissedBanner
                      onRetry={() => void handleProceedToBuy()}
                      onDismiss={() => { setPendingOrder(null); setCheckoutPhase("shopping"); }}
                    />
                  ) : null}
                  {checkoutPhase === "error" ? (
                    <ErrorBanner
                      message={checkoutError || "Something went wrong. Please try again."}
                      onDismiss={() => setCheckoutPhase("shopping")}
                    />
                  ) : null}
                </div>

                <button
                  type="button"
                  aria-label="Proceed to buy"
                  onClick={() => void handleProceedToBuy()}
                  disabled={lines.length === 0 || isProcessingCheckout}
                  className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessingCheckout ? "Processing..." : "Proceed to Buy"}
                </button>

                {delivery > 0 ? (
                  <p className="mt-3 text-center text-[0.67rem] text-primary/50">Free delivery on orders above ₹2,999</p>
                ) : null}

                {/* Sign-in gate overlay */}
                {!isLoading && !isAuthenticated ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-end"
                    style={{ background: "linear-gradient(to top, var(--color-secondary, #fdf6ee) 55%, transparent 100%)" }}
                  >
                    <div className="flex w-full flex-col items-center gap-3 px-6 pb-7 pt-12 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/18 bg-paper">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary/60" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-primary">Sign in to checkout</p>
                        <p className="mt-1 text-xs leading-relaxed text-primary/60">Create an account or sign in to place your order securely.</p>
                      </div>
                      <button type="button" onClick={() => { setIsMobileCheckoutOpen(false); setIsAuthModalOpen(true); }}
                        className="mt-1 inline-flex h-11 w-full items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90">
                        Sign in / Create Account
                      </button>
                      <p className="text-[0.65rem] text-primary/45">Free · No spam · Secure email link</p>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Use a secure email link to sync and protect your cart across devices."
      />
    </>
  );
}
