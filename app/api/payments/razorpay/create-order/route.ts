import { NextResponse } from "next/server";
import { ID, Permission, Query, Role } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";
import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";
import { errorMessage, log, newCorrelationId } from "@/lib/logger";
import { calculateCheckoutPricing, normalizeCheckoutLines } from "@/lib/payments/checkout-pricing";
import { getRazorpayClient, toPaise } from "@/lib/payments/razorpay-server";
import { listProductsFromCollection } from "@/lib/appwrite/products";

export const runtime = "nodejs";

const CURRENCY = "INR";
const SCOPE = "payments.create-order";
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

type ShippingAddressInput = {
  fullName?: unknown;
  phone?: unknown;
  line1?: unknown;
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
  const normalized = {
    fullName: normalizeText(address.fullName, 120),
    phone: normalizeText(address.phone, 24),
    line1: normalizeText(address.line1, 220),
    city: normalizeText(address.city, 120),
    state: normalizeText(address.state, 120),
    postalCode: normalizeText(address.postalCode, 24),
    country: normalizeText(address.country, 80) || "India",
  };

  const hasAllRequired =
    normalized.fullName &&
    normalized.phone &&
    normalized.line1 &&
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
    const [body, user] = await Promise.all([request.json(), getUserFromJwt(token)]);
    const inputLines = normalizeCheckoutLines((body as { lines?: unknown })?.lines);
    const shippingAddress = normalizeShippingAddress((body as { shippingAddress?: unknown }).shippingAddress);

    if (inputLines.length === 0) {
      return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
    }

    if (!shippingAddress) {
      return NextResponse.json({ error: "Complete shipping address is required." }, { status: 400 });
    }

    const rawCouponCode = normalizeText((body as { couponCode?: unknown }).couponCode, 50)
      .toUpperCase()
      .replace(/\s/g, "");

    const products = await listProductsFromCollection();
    const pricing = calculateCheckoutPricing({ products, lines: inputLines });

    if (pricing.lines.length === 0 || pricing.total <= 0) {
      return NextResponse.json({ error: "No payable products available in cart." }, { status: 400 });
    }

    // Server-side coupon validation — never trust the client's discount amount.
    let couponDiscount = 0;
    let validatedCouponCode = "";
    if (rawCouponCode) {
      try {
        const dbs = createDatabasesWithApiKey();
        const dbId = getDatabaseId();
        const couponsCol =
          (await resolveCollectionId({ databases: dbs, databaseId: dbId, candidates: ["coupons", "coupon"] })) ??
          "coupons";
        const couponResult = await dbs.listDocuments(dbId, couponsCol, [
          Query.equal("code", rawCouponCode),
          Query.equal("isActive", true),
          Query.limit(1),
        ]);
        if (couponResult.documents.length > 0) {
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
      } catch (couponErr) {
        log("warn", SCOPE, "coupon_validation_failed", { correlationId, message: errorMessage(couponErr) });
      }
    }

    const finalTotal = Math.max(0, pricing.subtotal - couponDiscount) + pricing.delivery;

    const razorpay = getRazorpayClient();
    const receipt = makeReceipt();
    const amountInPaise = toPaise(finalTotal);

    if (amountInPaise <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();
    const ordersCollectionId =
      (await resolveCollectionId({
        databases,
        databaseId,
        candidates: ["orders", "order"],
      })) ?? "orders";
    const paymentsCollectionId =
      (await resolveCollectionId({
        databases,
        databaseId,
        candidates: ["payments", "payment"],
      })) ?? "payments";

    const nowIso = new Date().toISOString();
    const itemsJson = JSON.stringify(pricing.lines);
    const shippingJson = JSON.stringify(shippingAddress);

    // Duplicate-click guard: reuse an in-flight "initiated" order if everything matches.
    try {
      const recent = await databases.listDocuments(databaseId, ordersCollectionId, [
        Query.equal("userId", user.$id),
        Query.equal("status", "initiated"),
        Query.orderDesc("$createdAt"),
        Query.limit(5),
      ]);

      const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
      const existing = recent.documents.find((doc) => {
        const createdMs = Date.parse(String(doc.$createdAt ?? doc.placedAt ?? ""));
        return (
          String(doc.itemsJson ?? "") === itemsJson &&
          Number(doc.totalAmount ?? -1) === finalTotal &&
          String(doc.shippingAddress ?? "") === shippingJson &&
          String(doc.paymentId ?? "") !== "" &&
          Number.isFinite(createdMs) &&
          createdMs >= cutoff
        );
      });

      if (existing) {
        log("info", SCOPE, "reused_open_order", {
          correlationId,
          internalOrderId: existing.$id,
          razorpayOrderId: String(existing.paymentId ?? ""),
          userId: user.$id,
        });

        return NextResponse.json({
          keyId: razorpay.keyId,
          currency: CURRENCY,
          amount: amountInPaise,
          razorpayOrderId: String(existing.paymentId ?? ""),
          internalOrderId: existing.$id,
          orderNumber: String(existing.orderNumber ?? ""),
          reused: true,
          customer: {
            name: user.name ?? "",
            email: user.email ?? "",
          },
          summary: {
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            delivery: pricing.delivery,
            total: pricing.total,
          },
        });
      }
    } catch (dedupeError) {
      // Non-fatal: fall through to normal creation if the lookup fails.
      log("warn", SCOPE, "dedupe_lookup_failed", { correlationId, message: errorMessage(dedupeError) });
    }

    const orderNumber = `ORD-${Date.now()}`;

    const order = await databases.createDocument(
      databaseId,
      ordersCollectionId,
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
      [
        Permission.read(Role.user(user.$id)),
        Permission.update(Role.user(user.$id)),
        Permission.read(Role.label("admin")),
        Permission.update(Role.label("admin")),
      ]
    );

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

    await Promise.all([
      databases.createDocument(
        databaseId,
        paymentsCollectionId,
        ID.unique(),
        {
          userId: user.$id,
          orderId: order.$id,
          provider: "razorpay",
          providerPaymentId: "",
          status: "created",
          amount: finalTotal,
          currency: CURRENCY,
          paymentMeta: JSON.stringify({
            razorpayOrderId: razorpayOrder.id,
            receipt,
          }),
          paidAt: null,
        },
        [
          Permission.read(Role.user(user.$id)),
          Permission.update(Role.user(user.$id)),
          Permission.read(Role.label("admin")),
          Permission.update(Role.label("admin")),
        ]
      ),
      databases.updateDocument(databaseId, ordersCollectionId, order.$id, {
        paymentId: razorpayOrder.id,
      }),
    ]);

    log("info", SCOPE, "created", {
      correlationId,
      internalOrderId: order.$id,
      razorpayOrderId: razorpayOrder.id,
      userId: user.$id,
      amount: amountInPaise,
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
      {
        error: "Failed to initialize Razorpay checkout.",
        correlationId,
      },
      { status: 500 }
    );
  }
}
