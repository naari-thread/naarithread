import type { ProductRecord } from "@/lib/appwrite/products";

export type CheckoutLineInput = {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
};

export type ValidatedCheckoutLine = {
  productId: string;
  imageUrl: string;
  quantity: number;
  size: string;
  color: string;
  productName: string;
  unitAmount: number;
  lineAmount: number;
};

export type CheckoutPricingResult = {
  lines: ValidatedCheckoutLine[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
};

export const FREE_DELIVERY_THRESHOLD = 2999;
export const STANDARD_DELIVERY_FEE = 99;

function normalizeText(value: unknown, limit = 64) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, limit);
}

function normalizeQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(99, Math.trunc(value)));
}

export function normalizeCheckoutLines(payload: unknown) {
  if (!Array.isArray(payload)) {
    return [] as CheckoutLineInput[];
  }

  const lines: CheckoutLineInput[] = [];

  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const productId = normalizeText((item as { productId?: unknown }).productId);
    const quantity = normalizeQuantity((item as { quantity?: unknown }).quantity);

    if (!productId || quantity <= 0) {
      continue;
    }

    lines.push({
      productId,
      quantity,
      size: normalizeText((item as { size?: unknown }).size, 40),
      color: normalizeText((item as { color?: unknown }).color, 40),
    });
  }

  return lines;
}

export function calculateCheckoutPricing(args: {
  products: ProductRecord[];
  lines: CheckoutLineInput[];
}): CheckoutPricingResult {
  const productById = new Map(args.products.map((product) => [product.id, product] as const));
  const validLines: ValidatedCheckoutLine[] = [];

  for (const line of args.lines) {
    const product = productById.get(line.productId);
    if (!product || !product.isActive || product.stockQty <= 0) {
      continue;
    }

    const quantity = Math.min(line.quantity, Math.max(0, product.stockQty));
    if (quantity <= 0) {
      continue;
    }

    const unitAmount = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
    const lineAmount = unitAmount * quantity;

    validLines.push({
      productId: product.id,
      imageUrl: product.mainImageUrl,
      quantity,
      size: line.size?.trim() ?? "",
      color: line.color?.trim() ?? "",
      productName: product.name,
      unitAmount,
      lineAmount,
    });
  }

  const subtotal = validLines.reduce((sum, line) => sum + line.lineAmount, 0);
  const originalTotal = validLines.reduce((sum, line) => {
    const product = productById.get(line.productId);
    if (!product) {
      return sum;
    }

    return sum + product.originalPrice * line.quantity;
  }, 0);

  const discount = Math.max(0, originalTotal - subtotal);
  const delivery = validLines.length === 0 || subtotal > FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
  const total = subtotal + delivery;

  return {
    lines: validLines,
    subtotal,
    discount,
    delivery,
    total,
  };
}
