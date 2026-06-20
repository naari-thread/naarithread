import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { createDatabasesWithApiKey, getDatabaseId, getUserFromJwt } from "@/lib/appwrite/admin-server";

export const runtime = "nodejs";

const COUPONS_COL = "coupons";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("bearer ")) return "";
  return header.slice(7).trim();
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ valid: false, message: "Sign in to apply coupons." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { code?: unknown; subtotal?: unknown };
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const subtotal =
      typeof body.subtotal === "number" && Number.isFinite(body.subtotal) ? Math.max(0, body.subtotal) : 0;

    if (!code) {
      return NextResponse.json({ valid: false, message: "Please enter a coupon code." });
    }

    await getUserFromJwt(token);

    const databases = createDatabasesWithApiKey();
    const databaseId = getDatabaseId();

    const result = await databases.listDocuments(databaseId, COUPONS_COL, [
      Query.equal("code", code),
      Query.equal("isActive", true),
      Query.limit(1),
    ]);

    if (result.documents.length === 0) {
      return NextResponse.json({ valid: false, message: "This coupon code doesn't exist or has expired." });
    }

    const coupon = result.documents[0];
    const minOrderValue = Number(coupon.minOrderValue ?? 0);
    const discountType = String(coupon.discountType ?? "flat");
    const discountValue = Number(coupon.discountValue ?? 0);
    const maxDiscount = Number(coupon.maxDiscount ?? 0);
    const usageLimit = Number(coupon.usageLimit ?? 0);
    const usedCount = Number(coupon.usedCount ?? 0);

    if (usageLimit > 0 && usedCount >= usageLimit) {
      return NextResponse.json({ valid: false, message: "This coupon has reached its usage limit and is no longer available." });
    }

    if (subtotal > 0 && minOrderValue > 0 && subtotal < minOrderValue) {
      return NextResponse.json({
        valid: false,
        message: `Add ₹${(minOrderValue - subtotal).toLocaleString("en-IN")} more to unlock this coupon (minimum order: ₹${minOrderValue.toLocaleString("en-IN")}).`,
      });
    }

    let discountAmount = 0;
    if (discountType === "percentage") {
      const pct = Math.min(100, Math.max(0, discountValue));
      discountAmount = (subtotal * pct) / 100;
      if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
    } else {
      discountAmount = discountValue;
      if (maxDiscount > 0) discountAmount = Math.min(discountAmount, maxDiscount);
    }
    discountAmount = Math.min(Math.floor(discountAmount), subtotal);

    const configuredDescription = String(coupon.description ?? "").trim();
    const generatedDescription =
      discountType === "percentage"
        ? `${discountValue}% off${maxDiscount ? ` (max ₹${maxDiscount.toLocaleString("en-IN")})` : ""}`
        : `₹${discountValue.toLocaleString("en-IN")} off`;

    const description = configuredDescription || generatedDescription;

    return NextResponse.json({
      valid: true,
      code,
      discountAmount,
      description,
      message: `Coupon applied — you save ₹${discountAmount.toLocaleString("en-IN")}! 🎉`,
    });
  } catch {
    return NextResponse.json({ valid: false, message: "Unable to check this coupon right now. Please try again." }, { status: 500 });
  }
}
