import { ID, Query, type Databases } from "node-appwrite";

import { resolveCollectionId } from "@/lib/appwrite/collection-resolver";

export type WalletSummary = {
  balance: number;
  transactions: WalletTransaction[];
};

export type WalletTransaction = {
  id: string;
  type: "spent" | "refunded";
  amount: number;
  source: string;
  date: string;
};

type WalletDocument = {
  $id: string;
  userId: string;
  balance: number;
  updatedAt?: string;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toText(value: unknown, max = 300) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, max);
}

async function resolveWalletCollectionId(databases: Databases, databaseId: string) {
  return resolveCollectionId({
    databases,
    databaseId,
    candidates: ["wallets", "wallet"],
  });
}

async function resolveWalletTransactionCollectionId(databases: Databases, databaseId: string) {
  return resolveCollectionId({
    databases,
    databaseId,
    candidates: ["wallet_transactions", "walletTransactions", "wallettransactions"],
  });
}

async function getOrCreateWallet(args: {
  databases: Databases;
  databaseId: string;
  userId: string;
}) {
  const walletCollectionId = await resolveWalletCollectionId(args.databases, args.databaseId);
  if (!walletCollectionId) {
    throw new Error("Wallet collection is missing. Run appwrite setup script.");
  }

  const existing = await args.databases.listDocuments(args.databaseId, walletCollectionId, [
    Query.equal("userId", args.userId),
    Query.limit(1),
  ]);

  if (existing.documents[0]) {
    const doc = existing.documents[0] as unknown as WalletDocument;
    return {
      collectionId: walletCollectionId,
      wallet: {
        $id: doc.$id,
        userId: String(doc.userId ?? args.userId),
        balance: Math.max(0, toNumber(doc.balance)),
        updatedAt: toText(doc.updatedAt, 100),
      },
    };
  }

  const created = await args.databases.createDocument(args.databaseId, walletCollectionId, ID.unique(), {
    userId: args.userId,
    balance: 0,
    updatedAt: new Date().toISOString(),
  });

  return {
    collectionId: walletCollectionId,
    wallet: {
      $id: created.$id,
      userId: args.userId,
      balance: 0,
      updatedAt: new Date().toISOString(),
    },
  };
}

export async function listWalletSummary(args: {
  databases: Databases;
  databaseId: string;
  userId: string;
}): Promise<WalletSummary> {
  const walletCollectionId = await resolveWalletCollectionId(args.databases, args.databaseId);
  const walletTxnCollectionId = await resolveWalletTransactionCollectionId(args.databases, args.databaseId);

  if (!walletCollectionId || !walletTxnCollectionId) {
    return {
      balance: 0,
      transactions: [],
    };
  }

  const [walletList, txnList] = await Promise.all([
    args.databases.listDocuments(args.databaseId, walletCollectionId, [Query.equal("userId", args.userId), Query.limit(1)]),
    args.databases.listDocuments(args.databaseId, walletTxnCollectionId, [
      Query.equal("userId", args.userId),
      Query.orderDesc("$createdAt"),
      Query.limit(25),
    ]),
  ]);

  const walletDoc = walletList.documents[0] as unknown as WalletDocument | undefined;

  return {
    balance: walletDoc ? Math.max(0, toNumber(walletDoc.balance)) : 0,
    transactions: txnList.documents.map((doc) => {
      const amount = Math.max(0, toNumber((doc as Record<string, unknown>).amount));
      const typeRaw = String((doc as Record<string, unknown>).type ?? "").toLowerCase();
      const createdAt = String((doc as Record<string, unknown>).createdAt ?? doc.$createdAt ?? "");

      return {
        id: doc.$id,
        type: typeRaw.includes("refund") ? "refunded" : "spent",
        amount,
        source: toText((doc as Record<string, unknown>).source, 300) || "Wallet activity",
        date: createdAt,
      };
    }),
  };
}

export async function creditRefundToWallet(args: {
  databases: Databases;
  databaseId: string;
  userId: string;
  orderId: string;
  amount: number;
  source: string;
}) {
  const creditAmount = Math.max(0, Math.round(args.amount * 100) / 100);
  if (creditAmount <= 0) {
    throw new Error("Invalid refund amount.");
  }

  const walletTxnCollectionId = await resolveWalletTransactionCollectionId(args.databases, args.databaseId);
  if (!walletTxnCollectionId) {
    throw new Error("Wallet transaction collection is missing. Run appwrite setup script.");
  }

  const existingRefund = await args.databases.listDocuments(args.databaseId, walletTxnCollectionId, [
    Query.equal("userId", args.userId),
    Query.equal("referenceOrderId", args.orderId),
    Query.equal("type", "refund_credit"),
    Query.limit(1),
  ]);

  if (existingRefund.total > 0) {
    return {
      alreadyCredited: true,
      creditedAmount: creditAmount,
    };
  }

  const { collectionId: walletCollectionId, wallet } = await getOrCreateWallet({
    databases: args.databases,
    databaseId: args.databaseId,
    userId: args.userId,
  });

  const nextBalance = Math.round((wallet.balance + creditAmount) * 100) / 100;
  const nowIso = new Date().toISOString();

  await Promise.all([
    args.databases.updateDocument(args.databaseId, walletCollectionId, wallet.$id, {
      balance: nextBalance,
      updatedAt: nowIso,
    }),
    args.databases.createDocument(args.databaseId, walletTxnCollectionId, ID.unique(), {
      userId: args.userId,
      type: "refund_credit",
      amount: creditAmount,
      source: toText(args.source, 300) || `Refund for ${args.orderId}`,
      referenceOrderId: args.orderId,
      createdAt: nowIso,
    }),
  ]);

  return {
    alreadyCredited: false,
    creditedAmount: creditAmount,
    balance: nextBalance,
  };
}
