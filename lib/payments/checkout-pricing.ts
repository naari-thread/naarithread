import type { ProductRecord } from "@/lib/appwrite/products";
import { getAvailableStockForSize } from "@/lib/product-merchandising";
import { z } from "zod";

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
  issues: CheckoutInventoryIssue[];
  subtotal: number;
  discount: number;
  delivery: number;
  total: number;
};

export type CheckoutInventoryIssue = {
  productId: string;
  code: "unavailable" | "size_required" | "color_required" | "invalid_option" | "insufficient_stock";
  message: string;
};

/**
 * Why a single cart line cannot be checked out, or null when it is fine.
 *
 * The same rules run again on the server inside `calculateCheckoutPricing()`;
 * this exists so the cart page can flag a broken line while the shopper is still
 * looking at it, instead of failing at the moment they try to pay.
 */
export type CartLineAvailabilityIssue = {
  code: "unavailable" | "size_required" | "size_removed" | "color_required" | "color_removed" | "out_of_stock" | "reduce_quantity";
  message: string;
  /** Units the shopper can actually buy right now; 0 when nothing is left. */
  availableStock: number;
  /**
   * Quantity this specific line can be set to, which is lower than
   * `availableStock` when another cart line already claims part of that stock.
   * 0 means the line has to be removed or changed rather than reduced.
   */
  suggestedQuantity: number;
  /** True when the product is still sellable in some other size or colour. */
  canChooseAnother: boolean;
};

export function getCartLineAvailabilityIssue(args: {
  product: ProductRecord;
  size: string;
  color: string;
  quantity: number;
  /**
   * Total units of this product/size across every cart line, which can exceed
   * `quantity` when the same size sits in the cart twice in different colours.
   * The server checks stock against this combined figure, so the cart must too.
   * Defaults to `quantity`.
   */
  requestedQuantity?: number;
}): CartLineAvailabilityIssue | null {
  const { product, quantity } = args;
  const requestedQuantity = args.requestedQuantity ?? quantity;
  const size = args.size.trim();
  const color = args.color.trim();

  if (!product.isActive || product.stockQty <= 0) {
    return {
      code: "unavailable",
      message: "This product is no longer available.",
      availableStock: 0,
      suggestedQuantity: 0,
      canChooseAnother: false,
    };
  }

  if (product.sizeOptions.length > 0 && !size) {
    return { code: "size_required", message: "Choose a size to continue.", availableStock: 0, suggestedQuantity: 0, canChooseAnother: true };
  }

  if (size && product.sizeOptions.length > 0 && !product.sizeOptions.includes(size)) {
    return {
      code: "size_removed",
      message: `Size ${size} is no longer offered. Pick another size to continue.`,
      availableStock: 0,
      suggestedQuantity: 0,
      canChooseAnother: true,
    };
  }

  if (product.colorOptions.length > 0 && !color) {
    return { code: "color_required", message: "Choose a colour to continue.", availableStock: 0, suggestedQuantity: 0, canChooseAnother: true };
  }

  if (color && product.colorOptions.length > 0 && !product.colorOptions.includes(color)) {
    return {
      code: "color_removed",
      message: `The colour ${color} is no longer offered. Pick another colour to continue.`,
      availableStock: 0,
      suggestedQuantity: 0,
      canChooseAnother: true,
    };
  }

  const availableStock = product.sizeInventory.length > 0
    ? getAvailableStockForSize(product.sizeInventory, size)
    : product.stockQty;

  if (availableStock <= 0) {
    return {
      code: "out_of_stock",
      message: size ? `Size ${size} is out of stock.` : "This product is out of stock.",
      availableStock: 0,
      suggestedQuantity: 0,
      canChooseAnother: product.stockQty > 0,
    };
  }

  if (requestedQuantity > availableStock) {
    const sharedWithOtherLines = requestedQuantity > quantity;
    const claimedByOtherLines = requestedQuantity - quantity;
    return {
      suggestedQuantity: Math.max(0, availableStock - claimedByOtherLines),
      code: "reduce_quantity",
      message: sharedWithOtherLines
        ? `Only ${availableStock} left${size ? ` in size ${size}` : ""} across the items in your cart. Reduce the quantity to continue.`
        : `Only ${availableStock} left${size ? ` in size ${size}` : ""}. Reduce the quantity to continue.`,
      availableStock,
      canChooseAnother: true,
    };
  }

  return null;
}

export const FREE_DELIVERY_THRESHOLD = 2999;
export const STANDARD_DELIVERY_FEE = 99;

const checkoutLineSchema = z.object({
  productId: z.string().trim().min(1).max(64),
  quantity: z.number().finite().int().min(1).max(99),
  size: z.string().trim().max(40).optional().default(""),
  color: z.string().trim().max(40).optional().default(""),
});

const checkoutLinesSchema = z.array(checkoutLineSchema).max(100);

export function normalizeCheckoutLines(payload: unknown): CheckoutLineInput[] {
  const result = checkoutLinesSchema.safeParse(payload);
  return result.success ? result.data : [];
}

export function calculateCheckoutPricing(args: {
  products: ProductRecord[];
  lines: CheckoutLineInput[];
}): CheckoutPricingResult {
  const productById = new Map(args.products.map((product) => [product.id, product] as const));
  const validLines: ValidatedCheckoutLine[] = [];
  const issues: CheckoutInventoryIssue[] = [];
  const requestedBySize = new Map<string, number>();

  for (const line of args.lines) {
    const key = `${line.productId}\u0000${line.size?.trim() ?? ""}`;
    requestedBySize.set(key, (requestedBySize.get(key) ?? 0) + line.quantity);
  }

  for (const line of args.lines) {
    const product = productById.get(line.productId);
    if (!product || !product.isActive || product.stockQty <= 0) {
      issues.push({
        productId: line.productId,
        code: "unavailable",
        message: "This product is no longer available.",
      });
      continue;
    }

    const size = line.size?.trim() ?? "";
    const color = line.color?.trim() ?? "";
    if (product.sizeOptions.length > 0 && !size) {
      issues.push({ productId: product.id, code: "size_required", message: `Choose a size for ${product.name}.` });
      continue;
    }
    if (size && product.sizeOptions.length > 0 && !product.sizeOptions.includes(size)) {
      issues.push({ productId: product.id, code: "invalid_option", message: `The selected size for ${product.name} is invalid.` });
      continue;
    }
    if (product.colorOptions.length > 0 && !color) {
      issues.push({ productId: product.id, code: "color_required", message: `Choose a color for ${product.name}.` });
      continue;
    }
    if (color && product.colorOptions.length > 0 && !product.colorOptions.includes(color)) {
      issues.push({ productId: product.id, code: "invalid_option", message: `The selected color for ${product.name} is invalid.` });
      continue;
    }

    const availableStock = product.sizeInventory.length > 0
      ? getAvailableStockForSize(product.sizeInventory, size)
      : product.stockQty;
    const requestedQuantity = requestedBySize.get(`${product.id}\u0000${size}`) ?? line.quantity;
    if (requestedQuantity > availableStock) {
      issues.push({
        productId: product.id,
        code: "insufficient_stock",
        message: `Only ${availableStock} of ${product.name}${size ? ` in size ${size}` : ""} is available.`,
      });
      continue;
    }

    const unitAmount = product.discountPrice > 0 ? product.discountPrice : product.originalPrice;
    const lineAmount = unitAmount * line.quantity;

    validLines.push({
      productId: product.id,
      imageUrl: product.mainImageUrl,
      quantity: line.quantity,
      size,
      color,
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
    issues,
    subtotal,
    discount,
    delivery,
    total,
  };
}
