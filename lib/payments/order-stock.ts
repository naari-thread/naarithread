import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase/admin";
import { parseSizeInventory, type SizeInventoryItem } from "@/lib/product-merchandising";

const ORDERS_COLLECTION = "orders";
const PRODUCTS_COLLECTION = "products";

type OrderLine = {
  productId?: unknown;
  quantity?: unknown;
  size?: unknown;
};

type ParsedOrderLine = { productId: string; quantity: number; size: string };

function parseOrderLines(value: unknown): ParsedOrderLine[] {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item): ParsedOrderLine[] => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const line = item as OrderLine;
      const productId = typeof line.productId === "string" ? line.productId.trim() : "";
      const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity)
        ? Math.max(0, Math.trunc(line.quantity))
        : 0;
      const size = typeof line.size === "string" ? line.size.trim() : "";

      return productId && quantity > 0 ? [{ productId, quantity, size }] : [];
    });
  } catch {
    return [];
  }
}

export async function reduceStockForPaidOrder(orderId: string): Promise<boolean> {
  const normalizedOrderId = orderId.trim();
  if (!normalizedOrderId) {
    return false;
  }

  const db = getAdminDb();
  const orderRef = db.collection(ORDERS_COLLECTION).doc(normalizedOrderId);

  return db.runTransaction(async (transaction) => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) {
      return false;
    }

    const order = orderSnapshot.data() ?? {};
    if (order.stockReduced === true) {
      return false;
    }

    const lines = parseOrderLines(order.itemsJson);
    if (lines.length === 0) {
      return false;
    }

    const linesByProductId = new Map<string, ParsedOrderLine[]>();
    for (const line of lines) {
      linesByProductId.set(line.productId, [...(linesByProductId.get(line.productId) ?? []), line]);
    }
    const productRefs = [...linesByProductId.keys()].map((productId) =>
      db.collection(PRODUCTS_COLLECTION).doc(productId)
    );
    const productSnapshots = await transaction.getAll(...productRefs);
    const nowIso = new Date().toISOString();
    const updates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      stockQty: number;
      sizeInventory: SizeInventoryItem[];
    }> = [];

    for (const productSnapshot of productSnapshots) {
      if (!productSnapshot.exists) {
        transaction.update(orderRef, {
          stockReductionError: `Product ${productSnapshot.id} no longer exists.`,
          stockReductionFailedAt: nowIso,
        });
        return false;
      }

      const productData = productSnapshot.data() ?? {};
      const productLines = linesByProductId.get(productSnapshot.id) ?? [];
      const sizeInventory = parseSizeInventory(productData.sizeInventory);
      const totalRequested = productLines.reduce((sum, line) => sum + line.quantity, 0);
      let nextInventory = sizeInventory;

      if (sizeInventory.length > 0) {
        const requestedBySize = new Map<string, number>();
        for (const line of productLines) {
          requestedBySize.set(line.size, (requestedBySize.get(line.size) ?? 0) + line.quantity);
        }

        for (const [size, requested] of requestedBySize) {
          const available = sizeInventory.find((item) => item.size === size)?.stockQty ?? 0;
          if (!size || requested > available) {
            transaction.update(orderRef, {
              stockReductionError: `Insufficient stock for product ${productSnapshot.id}${size ? `, size ${size}` : ""}.`,
              stockReductionFailedAt: nowIso,
            });
            return false;
          }
        }

        nextInventory = sizeInventory.map((item) => ({
          ...item,
          stockQty: item.stockQty - (requestedBySize.get(item.size) ?? 0),
        }));
      } else {
        const currentStock = Math.max(0, Number(productData.stockQty ?? 0));
        if (totalRequested > currentStock) {
          transaction.update(orderRef, {
            stockReductionError: `Insufficient stock for product ${productSnapshot.id}.`,
            stockReductionFailedAt: nowIso,
          });
          return false;
        }
      }

      const currentStock = Math.max(0, Number(productData.stockQty ?? 0));
      const nextStock = sizeInventory.length > 0
        ? nextInventory.reduce((sum, item) => sum + item.stockQty, 0)
        : currentStock - totalRequested;

      updates.push({ ref: productSnapshot.ref, stockQty: nextStock, sizeInventory: nextInventory });
    }

    for (const update of updates) {
      transaction.update(update.ref, {
        stockQty: update.stockQty,
        sizeInventory: JSON.stringify(update.sizeInventory),
        inStock: update.stockQty > 0,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.update(orderRef, {
      stockReduced: true,
      stockReducedAt: nowIso,
    });

    return true;
  });
}
