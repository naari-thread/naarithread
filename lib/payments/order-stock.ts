import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase/admin";

const ORDERS_COLLECTION = "orders";
const PRODUCTS_COLLECTION = "products";

type OrderLine = {
  productId?: unknown;
  quantity?: unknown;
};

function parseOrderLines(value: unknown): Array<{ productId: string; quantity: number }> {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item): Array<{ productId: string; quantity: number }> => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const line = item as OrderLine;
      const productId = typeof line.productId === "string" ? line.productId.trim() : "";
      const quantity = typeof line.quantity === "number" && Number.isFinite(line.quantity)
        ? Math.max(0, Math.trunc(line.quantity))
        : 0;

      return productId && quantity > 0 ? [{ productId, quantity }] : [];
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

    const quantitiesByProductId = new Map<string, number>();
    for (const line of lines) {
      quantitiesByProductId.set(
        line.productId,
        (quantitiesByProductId.get(line.productId) ?? 0) + line.quantity
      );
    }
    const productRefs = [...quantitiesByProductId.keys()].map((productId) =>
      db.collection(PRODUCTS_COLLECTION).doc(productId)
    );
    const productSnapshots = await transaction.getAll(...productRefs);
    const nowIso = new Date().toISOString();

    for (const productSnapshot of productSnapshots) {
      if (!productSnapshot.exists) {
        continue;
      }

      const currentStock = Number(productSnapshot.data()?.stockQty ?? 0);
      const nextStock = Math.max(0, currentStock - (quantitiesByProductId.get(productSnapshot.id) ?? 0));

      transaction.update(productSnapshot.ref, {
        stockQty: nextStock,
        inStock: nextStock > 0,
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
