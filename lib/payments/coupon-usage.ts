import { FieldValue } from "firebase-admin/firestore";

import { getAdminDb } from "@/lib/firebase/admin";

const ORDERS_COLLECTION = "orders";
const COUPONS_COLLECTION = "coupons";

export async function markCouponRedeemedForPaidOrder(orderId: string): Promise<boolean> {
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
    if (order.couponUsageCounted === true) {
      return false;
    }

    const couponCode = typeof order.couponCode === "string" ? order.couponCode.trim().toUpperCase() : "";
    if (!couponCode) {
      return false;
    }

    const couponQuery = db.collection(COUPONS_COLLECTION).where("code", "==", couponCode).limit(1);
    const couponSnapshot = await transaction.get(couponQuery);
    const couponDocument = couponSnapshot.docs[0];
    if (!couponDocument) {
      return false;
    }

    const nowIso = new Date().toISOString();
    transaction.update(couponDocument.ref, {
      usedCount: FieldValue.increment(1),
      usageCount: FieldValue.increment(1),
      lastRedeemedAt: nowIso,
    });
    transaction.update(orderRef, {
      couponUsageCounted: true,
      couponUsageCountedAt: nowIso,
    });

    return true;
  });
}
