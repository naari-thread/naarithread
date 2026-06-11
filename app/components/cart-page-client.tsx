"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
  areProductsEquivalent,
  fetchCatalogProductsFromApi,
  readCachedProductSnapshot,
  writeCachedProductSnapshot,
} from "@/lib/product-catalog-cache";

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
  line1: string;
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
};

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
                {[info.address.line1, info.address.city, info.address.state, info.address.postalCode, info.address.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            </div>
          </div>
          <p className="mt-4 text-xs text-primary/55">
            You will receive an email confirmation shortly.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row">
            <Link
              href="/account"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-primary/20 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary transition hover:bg-primary/5"
            >
              View Orders
            </Link>
            <Link
              href="/products"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.2em] text-secondary transition hover:bg-primary/90"
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
        <Link href="/account" className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900">
          Check Orders
        </Link>
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
  const [pendingOrderId, setPendingOrderId] = useState<string>("");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddressForm>({
    fullName: "",
    phone: "",
    line1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });
  const [profileDocId, setProfileDocId] = useState<string>("");
  const [postalLookupPending, setPostalLookupPending] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

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
          savedAddress = { line1: profile.address };
        }
      }

      setShippingAddress((current) => {
        const isPristine =
          !current.fullName && !current.phone && !current.line1 && !current.city && !current.state && !current.postalCode;
        if (!isPristine) {
          return current;
        }

        return {
          fullName: savedAddress.fullName || profile.fullName || user.name || "",
          phone: savedAddress.phone || profile.phone || "",
          line1: savedAddress.line1 || "",
          city: savedAddress.city || "",
          state: savedAddress.state || "",
          postalCode: savedAddress.postalCode || "",
          country: savedAddress.country || "India",
        };
      });
    })();

    return () => {
      alive = false;
    };
  }, [isAuthenticated, user]);

  // Postal code → city + state autofill using India Post API.
  useEffect(() => {
    const code = shippingAddress.postalCode.trim();
    if (!/^\d{6}$/.test(code)) {
      return;
    }

    let alive = true;
    setPostalLookupPending(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${code}`);
        const data = (await res.json()) as Array<{
          Status: string;
          PostOffice?: Array<{ District: string; State: string }>;
        }>;

        if (!alive) return;

        if (data[0]?.Status === "Success" && data[0]?.PostOffice?.length) {
          const po = data[0].PostOffice[0];
          setShippingAddress((prev) => ({
            ...prev,
            city: prev.city || po.District,
            state: prev.state || po.State,
          }));
        }
      } catch {
        // silent — user can type manually
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
    const cachedProducts = readCachedProductSnapshot();

    if (cachedProducts.length > 0) {
      setProducts(cachedProducts);
    }

    const controller = new AbortController();

    const hydrateCatalog = async () => {
      try {
        const serverProducts = await fetchCatalogProductsFromApi(controller.signal);
        if (!alive || serverProducts.length === 0) {
          return;
        }

        if (!areProductsEquivalent(serverProducts, cachedProducts)) {
          setProducts(serverProducts);
          writeCachedProductSnapshot(serverProducts);
        }
      } finally {
        if (alive) {
          setHasCompletedCatalogSync(true);
        }
      }
    };

    void hydrateCatalog();

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
        setCouponError(data.message || "Invalid coupon code.");
      }
    } catch {
      setCouponError("Unable to validate coupon right now.");
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
      shippingAddress.line1.trim() &&
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

    try {
      const jwt = await createAuthJwt();
      const orderResponse = await fetch("/api/payments/razorpay/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          lines: lines.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
            size: cartSelections[line.product.id]?.size ?? "",
            color: cartSelections[line.product.id]?.color ?? "",
          })),
          shippingAddress,
          couponCode: appliedCoupon?.code ?? "",
        }),
      });

      const orderPayload = (await orderResponse.json()) as Partial<CreateOrderResponse> & { error?: string };

      if (!orderResponse.ok || !orderPayload.razorpayOrderId || !orderPayload.keyId || !orderPayload.internalOrderId) {
        throw new Error(orderPayload.error ?? "Unable to create payment order.");
      }

      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout. Please try again.");
      }

      const serverTotal = orderPayload.summary?.total ?? total;
      const currentInternalOrderId = orderPayload.internalOrderId!;
      setPendingOrderId(currentInternalOrderId);

      const checkout = new window.Razorpay({
        key: orderPayload.keyId,
        amount: Number(orderPayload.amount ?? 0),
        currency: orderPayload.currency ?? "INR",
        name: "NaariThread",
        description: "Secure checkout",
        order_id: orderPayload.razorpayOrderId,
        prefill: {
          name: orderPayload.customer?.name ?? "",
          email: orderPayload.customer?.email ?? "",
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
                  });
                  setCheckoutPhase("success");
                  return;
                }
              }
            } catch {
              // Fall through to cancelled state if check fails.
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

            const verifyPayload = (await verifyResponse.json()) as { error?: string };
            if (!verifyResponse.ok) {
              throw new Error(verifyPayload.error ?? "Payment verification failed.");
            }

            // Persist address back to user profile only when the checkbox is checked.
            if (saveAddress && profileDocId) {
              try {
                await updateUserProfile({
                  documentId: profileDocId,
                  fullName: shippingAddress.fullName.trim() || user?.name || "",
                  phone: shippingAddress.phone.trim(),
                  address: JSON.stringify(shippingAddress),
                });
              } catch {
                // Non-fatal: order already succeeded.
              }
            }

            writeCartItems({});
            writeCartItemSelections({});
            setCartItems({});
            setCartSelections({});
            setAppliedCoupon(null);
            setCouponCode("");

            setSuccessInfo({
              orderNumber: orderPayload.orderNumber ?? "",
              total: serverTotal,
              address: { ...shippingAddress },
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
          description="Use Email OTP to sync and protect your cart across devices."
        />
      </>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-paper px-4 pb-32 pt-6 text-primary sm:px-6 md:px-10 md:pb-16 md:pt-30">
        <section className="mx-auto w-full max-w-6xl">
          <header className={`pb-6 ${isLoading || isAuthenticated ? "border-b border-primary/15" : ""}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/70">Checkout</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Cart</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary/82 sm:text-base">
              Review your selected items and proceed with secure checkout.
            </p>
          </header>

          {!isLoading && !isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-y border-primary/15 py-5 text-sm text-primary/80"
            >
              <span>You are using local cart storage. Sign in to keep your cart synced and safe across devices.</span>
              <button
                type="button"
                aria-label="Sign in to sync cart"
                onClick={() => setIsAuthModalOpen(true)}
                className="shrink-0 inline-flex h-9 items-center justify-center rounded-lg border border-primary bg-primary px-4 text-xs font-semibold uppercase tracking-[0.16em] text-secondary transition hover:bg-primary/90"
              >
                Sign in
              </button>
            </motion.div>
          ) : null}

          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-12">
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
                          onClick={() => void updateQuantity(line.product.id, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-primary/10"
                        >
                          <DynamicHugeIcon name="Add01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden={true} />
                        </button>
                      </div>
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

            {/* ─── Order summary sidebar ────────────────────────── */}
            <aside className="rounded-2xl border border-primary/15 bg-secondary p-5 sm:p-6 lg:sticky lg:top-28">
              <h3 className="text-lg font-semibold">Amount Breakup</h3>

              {/* Shipping address */}
              <div className="mt-5 rounded-xl border border-primary/12 bg-paper p-3.5 sm:p-4">
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/62">
                  Shipping Address
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2.5">
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
                  <textarea
                    aria-label="Shipping address line"
                    placeholder="Address line"
                    value={shippingAddress.line1}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, line1: event.target.value }))
                    }
                    rows={2}
                    className="rounded-lg border border-primary/16 bg-secondary px-3 py-2 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Postal code with autofill indicator */}
                  <div className="relative">
                    <input
                      aria-label="Shipping postal code"
                      placeholder="Postal code"
                      maxLength={6}
                      value={shippingAddress.postalCode}
                      onChange={(event) => {
                        const val = event.target.value.replace(/\D/g, "").slice(0, 6);
                        // Clear city/state when postal code changes so autofill can re-run.
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
                  <div className="grid grid-cols-2 gap-2.5">
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
                  </div>
                  <input
                    aria-label="Shipping country"
                    placeholder="Country"
                    value={shippingAddress.country}
                    onChange={(event) =>
                      setShippingAddress((prev) => ({ ...prev, country: event.target.value }))
                    }
                    className="h-10 rounded-lg border border-primary/16 bg-secondary px-3 text-sm outline-none transition focus:border-primary/45"
                  />
                  {/* Save-for-later checkbox — only shown when user is signed in and has filled something */}
                  {isAuthenticated &&
                  (shippingAddress.fullName || shippingAddress.phone || shippingAddress.line1 || shippingAddress.city) ? (
                    <label className="flex cursor-pointer items-center gap-2.5 pt-0.5">
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
                    onDismiss={() => setCheckoutPhase("shopping")}
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
            </aside>
          </div>
        </section>
      </main>

      <AuthModal
        open={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign up / Login"
        description="Use Email OTP to sync and protect your cart across devices."
      />
    </>
  );
}
