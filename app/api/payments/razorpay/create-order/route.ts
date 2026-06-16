import { NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { calculateCheckoutPricing, normalizeCheckoutLines } from "@/lib/payments/checkout-pricing";
import { getRazorpayClient, toPaise } from "@/lib/payments/razorpay-server";
import { toProductRecord } from "@/lib/appwrite/products";
import { sendOrderConfirmation } from "@/lib/email/send";

export const runtime = "nodejs";

const CURRENCY = "INR";
const SCOPE = "payments.create-order";

// Hardcoded collection IDs — eliminates resolveCollectionId probe calls.
const SKU_COL = "sku";
const ORDERS_COL = "orders";
const COUPONS_COL = "coupons";

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

    // Parse body synchronously before any API calls.
    const body = (await request.json()) as {
      lines?: unknown;
      shippingAddress?: unknown;
      couponCode?: unknown;
    };

    const inputLines = normalizeCheckoutLines(body.lines);
    const shippingAddress = normalizeShippingAddress(body.shippingAddress);

    if (inputLines.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }
    if (!shippingAddress) {
      return NextResponse.json({ error: "Complete shipping address is required." }, { status: 400 });
    }

    const rawCouponCode = normalizeText(body.couponCode, 50).toUpperCase().replace(/\s/g, "");
    const cartProductIds = inputLines.map((l) => l.productId).filter(Boolean);

    // Round trip 1 — all three in parallel: verify JWT, fetch cart products, fetch coupon.
    const [user, productsResult, couponResult] = await Promise.all([
      getUserFromJwt(token),
      databases.listDocuments(databaseId, SKU_COL, [
        Query.equal("$id", cartProductIds),
        Query.limit(cartProductIds.length),
      ]),
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

    const products = productsResult.documents.map((doc) => toProductRecord(doc as Record<string, unknown>));
    const pricing = calculateCheckoutPricing({ products, lines: inputLines });

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
    const amountInPaise = toPaise(finalTotal);

    if (amountInPaise <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    const orderNumber = `ORD-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const itemsJson = JSON.stringify(pricing.lines);
    const shippingJson = JSON.stringify(shippingAddress);
    const receipt = makeReceipt();
    const permissions = [
      Permission.read(Role.user(user.$id)),
      Permission.update(Role.user(user.$id)),
      Permission.read(Role.label("admin")),
      Permission.update(Role.label("admin")),
    ];

    // Round trip 2 — create the order document.
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
        discountAmount: pricing.discount + couponDiscount,
        shippingAmount: pricing.delivery,
        couponCode: validatedCouponCode,
        paymentId: "",
        shippingAddress: shippingJson,
        placedAt: nowIso,
      },
      permissions
    );

    // Round trip 3 — create Razorpay order (needs order.$id for notes).
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

    // Round trip 4 — store Razorpay order ID on the order doc.
    // Payment document is created in the verify route after the user completes payment.
    await databases.updateDocument(databaseId, ORDERS_COL, order.$id, {
      paymentId: razorpayOrder.id,
    });

    log("info", SCOPE, "created", {
      correlationId,
      internalOrderId: order.$id,
      razorpayOrderId: razorpayOrder.id,
      userId: user.$id,
      amount: amountInPaise,
    });

    // Fire-and-forget confirmation email — never block the response on this
    void sendOrderConfirmation(user.email ?? "", {
      customerName: user.name ?? "",
      orderNumber,
      lines: pricing.lines,
      subtotal: pricing.subtotal,
      delivery: pricing.delivery,
      discount: pricing.discount,
      couponDiscount,
      total: finalTotal,
      address: shippingAddress,
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
