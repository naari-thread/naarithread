import { getAdminDb } from "@/lib/firebase/admin";

const COLLECTION = "walletCheckouts";

export type WalletCheckoutRecord = {
  userId: string;
  walletAmount: number;
  createdAt: string;
};

export async function setWalletCheckout(orderId: string, record: WalletCheckoutRecord): Promise<void> {
  await getAdminDb().collection(COLLECTION).doc(orderId).set(record);
}

export async function getWalletCheckout(orderId: string): Promise<WalletCheckoutRecord | null> {
  const doc = await getAdminDb().collection(COLLECTION).doc(orderId).get();
  if (!doc.exists) return null;
  return doc.data() as WalletCheckoutRecord;
}
