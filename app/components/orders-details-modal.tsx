"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type OrdersDetailsModalProps = {
  onClose?: () => void;
};

type OrderLine = {
  productId: string;
  quantity: number;
  productName: string;
  unitAmount: number;
  lineAmount: number;
};

type OrderItem = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  shippingAmount: number;
  discountAmount: number;
  placedAt: string;
  shippingAddress: string;
  items: OrderLine[];
  canRetryPayment: boolean;
};

type RetryPaymentResponse = {
  keyId: string;
  currency: string;
  amount: number;
  razorpayOrderId: string;
  internalOrderId: string;
  customer: {
    name: string;
    email: string;
  };
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount));
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

export function OrdersDetailsModal({ onClose }: OrdersDetailsModalProps) {
  const { user, createAuthJwt } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryingOrderId, setRetryingOrderId] = useState("");
  void onClose;

  const fetchOrders = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const jwt = await createAuthJwt();
      const response = await fetch("/api/account/orders", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });

      const payload = (await response.json()) as {
        orders?: OrderItem[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load orders.");
      }

      setOrders(Array.isArray(payload.orders) ? payload.orders : []);
      setError(null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load orders.");
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [createAuthJwt, user]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const handleRetryPayment = async (orderId: string) => {
    if (!user || retryingOrderId) {
      return;
    }

    setRetryingOrderId(orderId);

    try {
      const jwt = await createAuthJwt();
      const retryResponse = await fetch("/api/account/orders/retry-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({ orderId }),
      });

      const retryPayload = (await retryResponse.json()) as Partial<RetryPaymentResponse> & { error?: string };

      if (!retryResponse.ok || !retryPayload.razorpayOrderId || !retryPayload.keyId || !retryPayload.internalOrderId) {
        throw new Error(retryPayload.error ?? "Unable to start retry payment.");
      }

      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout.");
      }

      const checkout = new window.Razorpay({
        key: retryPayload.keyId,
        amount: Number(retryPayload.amount ?? 0),
        currency: retryPayload.currency ?? "INR",
        name: "NaariThread",
        description: "Retry payment",
        order_id: retryPayload.razorpayOrderId,
        prefill: {
          name: retryPayload.customer?.name ?? "",
          email: retryPayload.customer?.email ?? "",
        },
        retry: {
          enabled: true,
          max_count: 2,
        },
        notes: {
          internalOrderId: retryPayload.internalOrderId,
        },
        theme: {
          color: "#2B1A1A",
        },
        modal: {
          ondismiss: () => {
            toast.info("Retry checkout closed.");
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
                internalOrderId: retryPayload.internalOrderId,
                ...paymentResult,
              }),
            });

            const verifyPayload = (await verifyResponse.json()) as { error?: string };
            if (!verifyResponse.ok) {
              throw new Error(verifyPayload.error ?? "Payment verification failed.");
            }

            toast.success("Payment retry successful.");
            await fetchOrders();
          } catch (verifyError) {
            toast.error(verifyError instanceof Error ? verifyError.message : "Unable to confirm payment.");
          }
        },
      });

      checkout.open();
    } catch (retryError) {
      toast.error(retryError instanceof Error ? retryError.message : "Unable to retry payment.");
    } finally {
      setRetryingOrderId("");
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
        <p className="text-xs text-primary/70">Sign in to view your orders.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs text-primary/60">Loading orders...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 px-1 pb-1 sm:px-2 sm:pb-2">
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary/62">Orders</p>
          <p className="mt-2 text-sm font-medium text-primary">No order history available yet.</p>
          <p className="mt-1 text-xs text-primary/70">Your recent orders will appear here once available.</p>
        </div>
      ) : (
        orders.map((order) => (
          <article key={order.id} className="rounded-xl border border-primary/12 bg-paper p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/62">{order.orderNumber}</p>
                <p className="mt-1 text-sm font-semibold text-primary">{formatCurrency(order.totalAmount)}</p>
                <p className="mt-0.5 text-xs text-primary/66">Placed {formatDate(order.placedAt)}</p>
              </div>
              <div className="rounded-full border border-primary/16 bg-secondary px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-primary/78">
                {order.paymentStatus}
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {order.items.slice(0, 3).map((line) => (
                <div key={`${order.id}-${line.productId}`} className="flex items-center justify-between text-xs">
                  <p className="line-clamp-1 text-primary/82">{line.productName} x {line.quantity}</p>
                  <p className="font-semibold text-primary/88">{formatCurrency(line.lineAmount)}</p>
                </div>
              ))}
            </div>

            {order.canRetryPayment ? (
              <button
                type="button"
                aria-label={`Retry payment for ${order.orderNumber}`}
                onClick={() => void handleRetryPayment(order.id)}
                disabled={retryingOrderId === order.id}
                className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {retryingOrderId === order.id ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-secondary/30 border-t-secondary" />
                    Processing...
                  </>
                ) : (
                  <>
                    <DynamicHugeIcon name="ShoppingBag01Icon" className="h-3.5 w-3.5" iconStrokeWidth={2} aria-hidden={true} />
                    Retry Payment
                  </>
                )}
              </button>
            ) : null}
          </article>
        ))
      )}
    </div>
  );
}
