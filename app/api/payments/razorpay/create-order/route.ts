import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { createUserNotification } from "@/lib/appwrite/notifications";
import { deductWalletForCheckout, getWalletBalance } from "@/lib/appwrite/wallet-server";
import { PRODUCT_CATALOG_CACHE_TAG } from "@/lib/cache-tags";
import { setWalletCheckout } from "@/lib/firebase/wallet-checkouts";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { markCouponRedeemedForPaidOrder } from "@/lib/payments/coupon-usage";
import { sendPaidOrderConfirmationOnce } from "@/lib/payments/order-confirmation";
import { reduceStockForPaidOrder } from "@/lib/payments/order-stock";
import { calculateCheckoutPricing, normalizeCheckoutLines } from "@/lib/payments/checkout-pricing";
import { getRazorpayClient, toPaise } from "@/lib/payments/razorpay-server";
import { getProductsByIds } from "@/lib/appwrite/products";

export const runtime = "nodejs";

const CURRENCY = "INR";
const SCOPE = "payments.create-order";

// Hardcoded collection IDs — eliminates resolveCollectionId probe calls.
const ORDERS_COL = "orders";
const COUPONS_COL = "coupons";
const PAYMENTS_COL = "payments";

type ShippingAddressInput = {
  fullName?: unknown;
  phone?: unknown;
  houseNo?: unknown;
  locality?: unknown;
  landmark?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  country?: unknown;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return "";
  }
  return header.slice(7).trim();
}

function makeReceipt() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `NT${Date.now()}${random}`.slice(0, 40);
}

function normalizeText(value: unknown, max = 120) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, max);
}

function normalizeShippingAddress(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const address = raw as ShippingAddressInput;
  const houseNo = normalizeText(address.houseNo, 120);
  const locality = normalizeText(address.locality, 120);
  const landmark = normalizeText(address.landmark, 120);
  const line1 = [houseNo, locality, landmark].filter(Boolean).join(", ");

  const normalized = {
    fullName: normalizeText(address.fullName, 120),
    phone: normalizeText(address.phone, 24),
    houseNo,
    locality,
    landmark,
    line1,
    city: normalizeText(address.city, 120),
    state: normalizeText(address.state, 120),
    postalCode: normalizeText(address.postalCode, 24),
    country: normalizeText(address.country, 80) || "India",
  };

  const hasAllRequired =
    normalized.fullName &&
    normalized.phone &&
    normalized.houseNo &&
    normalized.locality &&
    normalized.city &&
    normalized.state &&
    normalized.postalCode &&
    normalized.country;

  if (!hasAllRequired) {
    return null;
  }

  return normalized;
}

async function runPostPaymentActions(
  correlationId: string,
  internalOrderId: string,
  orderNumber: string,
  userId: string,
) {
  await reduceStockForPaidOrder(internalOrderId);
  await markCouponRedeemedForPaidOrder(internalOrderId);
  await sendPaidOrderConfirmationOnce(internalOrderId);
  revalidateTag(PRODUCT_CATALOG_CACHE_TAG, { expire: 0 });
  revalidatePath("/products");
  revalidatePath("/products", "layout");
  revalidatePath("/api/catalog/products");
  createUserNotification({
    userId,
    title: "Order Confirmed",
    body: `Your order ${orderNumber} has been placed successfully.`,
    type: "order",
    metadata: { orderId: internalOrderId },
  }).catch((err: unknown) => {
    log("warn", SCOPE, "notification_failed", { correlationId, message: errorMessage(err) });
  });
}

export async function POST(request: Request) {
  const correlationId = newCorrelationId();
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  try {
    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const razorpay = getRazorpayClient();

    const body = (await request.json()) as {
      lines?: unknown;
      shippingAddress?: unknown;
      couponCode?: unknown;
      useWalletBalance?: unknown;
    };

    const inputLines = normalizeCheckoutLines(body.lines);
    const shippingAddress = normalizeShippingAddress(body.shippingAddress);
    const useWalletBalance = body.useWalletBalance === true;

    if (inputLines.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }
    if (!shippingAddress) {
      return NextResponse.json({ error: "Complete shipping address is required." }, { status: 400 });
    }

    const rawCouponCode = normalizeText(body.couponCode, 50).toUpperCase().replace(/\s/g, "");
    const cartProductIds = inputLines.map((l) => l.productId).filter(Boolean);

    const [user, products, couponResult] = await Promise.all([
      getUserFromJwt(token),
      getProductsByIds(cartProductIds),
      rawCouponCode
        ? databases
            .listDocuments(databaseId, COUPONS_COL, [
              Query.equal("code", rawCouponCode),
              Query.equal("isActive", true),
              Query.limit(1),
            ])
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const pricing = calculateCheckoutPricing({ products, lines: inputLines });

    if (pricing.issues.length > 0) {
      return NextResponse.json(
        { error: pricing.issues[0].message, inventoryIssues: pricing.issues },
        { status: 409 }
      );
    }

    if (pricing.lines.length === 0 || pricing.total <= 0) {
      return NextResponse.json({ error: "No payable products available in cart." }, { status: 400 });
    }

    // Server-side coupon validation — never trust the client's discount amount.
    let couponDiscount = 0;
    let validatedCouponCode = "";
    if (rawCouponCode && couponResult && couponResult.documents.length > 0) {
      const coupon = couponResult.documents[0];
      const minOrderValue = Number(coupon.minOrderValue ?? 0);
      const discountType = String(coupon.discountType ?? "flat");
      const discountValue = Number(coupon.discountValue ?? 0);
      const maxDiscount = Number(coupon.maxDiscount ?? 0);
      const usageLimit = Number(coupon.usageLimit ?? 0);
      const usedCount = Number(coupon.usedCount ?? 0);

      if ((usageLimit <= 0 || usedCount < usageLimit) && pricing.subtotal >= minOrderValue) {
        if (discountType === "percentage") {
          couponDiscount = (pricing.subtotal * Math.min(100, discountValue)) / 100;
          if (maxDiscount > 0) couponDiscount = Math.min(couponDiscount, maxDiscount);
        } else {
          couponDiscount = discountValue;
          if (maxDiscount > 0) couponDiscount = Math.min(couponDiscount, maxDiscount);
        }
        couponDiscount = Math.min(Math.floor(couponDiscount), pricing.subtotal);
        validatedCouponCode = rawCouponCode;
      }
    }

    const finalTotal = Math.max(0, pricing.subtotal - couponDiscount) + pricing.delivery;

    // Wallet discount — fetch live balance server-side so the client cannot inflate it.
    let walletDiscount = 0;
    if (useWalletBalance) {
      const walletBalance = await getWalletBalance(user.$id);
      walletDiscount = Math.min(walletBalance, finalTotal);
      walletDiscount = Math.round(walletDiscount * 100) / 100;
    }

    const chargeAmount = Math.max(0, finalTotal - walletDiscount);
    const amountInPaise = toPaise(chargeAmount);

    const orderNumber = `ORD-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const itemsJson = JSON.stringify(pricing.lines);
    const shippingJson = JSON.stringify(shippingAddress);
    const permissions = [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ];

    // ── Zero-pay path: wallet covers the entire order ─────────────────────────
    if (amountInPaise <= 0) {
      const order = await databases.createDocument(
        databaseId,
        ORDERS_COL,
        ID.unique(),
        {
          orderNumber,
          userId: user.$id,
          userEmail: user.email,
          status: "placed",
          paymentStatus: "paid",
          itemsJson,
          totalAmount: finalTotal,
          subtotalAmount: pricing.subtotal + pricing.discount,
          productDiscountAmount: pricing.discount,
          couponDiscountAmount: couponDiscount,
          discountAmount: pricing.discount + couponDiscount,
          shippingAmount: pricing.delivery,
          couponCode: validatedCouponCode,
          paymentId: "",
          shippingAddress: shippingJson,
          placedAt: nowIso,
          paidAt: nowIso,
        },
        permissions
      );

      // Create payment record for the wallet transaction.
      await databases.createDocument(
        databaseId,
        PAYMENTS_COL,
        order.$id,
        {
          userId: user.$id,
          orderId: order.$id,
          provider: "wallet",
          providerPaymentId: "",
          status: "paid",
          amount: finalTotal,
          currency: "INR",
          paymentMeta: JSON.stringify({ walletAmount: walletDiscount }),
          paidAt: nowIso,
        },
        permissions
      );

      // Deduct wallet balance atomically.
      await deductWalletForCheckout({
        userId: user.$id,
        orderId: order.$id,
        amount: walletDiscount,
        source: `Checkout payment for order ${orderNumber}`,
      });

      // Run all post-payment actions (stock, coupon, email, notification).
      await runPostPaymentActions(correlationId, order.$id, orderNumber, user.$id);

      log("info", SCOPE, "zero_pay_completed", {
        correlationId,
        internalOrderId: order.$id,
        orderNumber,
        userId: user.$id,
        walletAmount: walletDiscount,
      });

      return NextResponse.json({
        zeroPay: true,
        internalOrderId: order.$id,
        orderNumber,
        summary: {
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          couponDiscount,
          delivery: pricing.delivery,
          walletDiscount,
          total: finalTotal,
        },
      });
    }

    // ── Partial / no-wallet path: charge via Razorpay ─────────────────────────
    const receipt = makeReceipt();

    const order = await databases.createDocument(
      databaseId,
      ORDERS_COL,
      ID.unique(),
      {
        orderNumber,
        userId: user.$id,
        userEmail: user.email,
        status: "initiated",
        paymentStatus: "created",
        itemsJson,
        totalAmount: finalTotal,
        subtotalAmount: pricing.subtotal + pricing.discount,
        productDiscountAmount: pricing.discount,
        couponDiscountAmount: couponDiscount,
        discountAmount: pricing.discount + couponDiscount,
        shippingAmount: pricing.delivery,
        couponCode: validatedCouponCode,
        paymentId: "",
        shippingAddress: shippingJson,
        placedAt: nowIso,
      },
      permissions
    );

    // Store wallet amount so the verify route can adjust the expected charge.
    if (walletDiscount > 0) {
      await setWalletCheckout(order.$id, {
        userId: user.$id,
        walletAmount: walletDiscount,
        createdAt: nowIso,
      });
    }

    const razorpayOrder = await razorpay.client.orders.create({
      amount: amountInPaise,
      currency: CURRENCY,
      receipt,
      payment_capture: true,
      notes: {
        internalOrderId: order.$id,
        userId: user.$id,
        userEmail: user.email,
      },
    });

    await databases.updateDocument(databaseId, ORDERS_COL, order.$id, {
      paymentId: razorpayOrder.id,
    });

    log("info", SCOPE, "created", {
      correlationId,
      internalOrderId: order.$id,
      razorpayOrderId: razorpayOrder.id,
      userId: user.$id,
      amount: amountInPaise,
      walletDiscount,
    });

    return NextResponse.json({
      keyId: razorpay.keyId,
      currency: CURRENCY,
      amount: amountInPaise,
      razorpayOrderId: razorpayOrder.id,
      internalOrderId: order.$id,
      orderNumber,
      customer: {
        name: user.name ?? "",
        email: user.email ?? "",
      },
      summary: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        couponDiscount,
        delivery: pricing.delivery,
        walletDiscount,
        total: finalTotal,
      },
    });
  } catch (error) {
    log("error", SCOPE, "failed", { correlationId, message: errorMessage(error) });
    return NextResponse.json(
      { error: "Failed to initialize Razorpay checkout.", correlationId },
      { status: 500 }
    );
  }
}
