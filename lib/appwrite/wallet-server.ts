import crypto from "node:crypto";

import { type CollectionReference, type DocumentData, type DocumentReference, type Firestore, type QueryDocumentSnapshot, type Transaction } from "firebase-admin/firestore";

import { createUserNotification } from "@/lib/appwrite/notifications";
import { getAdminDb } from "@/lib/firebase/admin";
import { timestampToIso } from "@/lib/firebase/document";

const WALLETS_COLLECTION = "wallets";
const WALLET_TRANSACTIONS_COLLECTION = "walletTransactions";
const WALLET_PAYOUT_REQUESTS_COLLECTION = "walletPayoutRequests";
const REFUND_MATURITY_DAYS = 7;

export type WalletTransactionType = "refund_credit" | "withdrawal_paid" | "withdrawal_released";

export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  amount: number;
  source: string;
  date: string;
  maturityAt: string;
  withdrawalStatus: "available" | "reserved" | "paid_out";
  payoutRequestId: string;
  payoutRequestNumber: string;
};

export type WalletPayoutRequest = {
  id: string;
  requestNumber: string;
  amount: number;
  status: "requested" | "processing" | "paid" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
  payoutMethod: "upi" | "bank_transfer";
  accountHolderName: string;
  upiId: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  note: string;
  adminNote: string;
  transferReference: string;
};

export type WalletSummary = {
  balance: number;
  availableToTransfer: number;
  pendingTransferAmount: number;
  nextEligibleAt: string;
  hasOpenPayoutRequest: boolean;
  transactions: WalletTransaction[];
  payoutRequests: WalletPayoutRequest[];
};

export type WalletPayoutInput = {
  payoutMethod: "upi" | "bank_transfer";
  accountHolderName: string;
  upiId: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  note: string;
};

export type WalletPayoutCreateResult =
  | {
      ok: true;
      requestId: string;
      requestNumber: string;
      amount: number;
    }
  | {
      ok: false;
      code: "already-requested" | "nothing-eligible" | "invalid-details";
      message: string;
    };

export type WalletPayoutStatusUpdateResult =
  | {
      ok: true;
      nextStatus: "processing" | "paid" | "rejected" | "cancelled";
      requestNumber: string;
      amount: number;
      userId: string;
    }
  | {
      ok: false;
      code: "not-found" | "invalid-transition";
      message: string;
    };

type WalletDocument = {
  userId: string;
  balance: number;
  reservedBalance: number;
  createdAt: string;
  updatedAt: string;
};

type WalletTransactionDocument = {
  userId: string;
  type: WalletTransactionType;
  amount: number;
  source: string;
  referenceOrderId: string;
  createdAt: string;
  updatedAt: string;
  maturityAt: string;
  withdrawalStatus: "available" | "reserved" | "paid_out";
  payoutRequestId: string;
  payoutRequestNumber: string;
};

type WalletPayoutRequestDocument = {
  userId: string;
  requestNumber: string;
  amount: number;
  status: "requested" | "processing" | "paid" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
  customerName: string;
  customerEmail: string;
  payoutMethod: "upi" | "bank_transfer";
  accountHolderName: string;
  upiId: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  note: string;
  adminNote: string;
  transferReference: string;
};

function walletsCollection(db: Firestore): CollectionReference<DocumentData> {
  return db.collection(WALLETS_COLLECTION);
}

function walletTransactionsCollection(db: Firestore): CollectionReference<DocumentData> {
  return db.collection(WALLET_TRANSACTIONS_COLLECTION);
}

function walletPayoutRequestsCollection(db: Firestore): CollectionReference<DocumentData> {
  return db.collection(WALLET_PAYOUT_REQUESTS_COLLECTION);
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toText(value: unknown, max = 300): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, max);
}

function toRoundedAmount(value: number): number {
  return Math.max(0, Math.round(value * 100) / 100);
}

function buildMaturityAt(from: Date): string {
  const maturity = new Date(from.getTime());
  maturity.setDate(maturity.getDate() + REFUND_MATURITY_DAYS);
  return maturity.toISOString();
}

function buildRequestNumber(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `RFR-${y}${m}${d}-${suffix}`;
}

function mapWalletTransaction(snapshot: QueryDocumentSnapshot<DocumentData>): WalletTransaction {
  const data = snapshot.data() as Partial<WalletTransactionDocument>;

  return {
    id: snapshot.id,
    type: (toText(data.type, 40) as WalletTransactionType) || "refund_credit",
    amount: toRoundedAmount(toNumber(data.amount)),
    source: toText(data.source, 300) || "Refund Wallet activity",
    date: timestampToIso(data.createdAt) || timestampToIso(snapshot.createTime),
    maturityAt: timestampToIso(data.maturityAt),
    withdrawalStatus: (toText(data.withdrawalStatus, 40) as WalletTransaction["withdrawalStatus"]) || "available",
    payoutRequestId: toText(data.payoutRequestId, 100),
    payoutRequestNumber: toText(data.payoutRequestNumber, 100),
  };
}

function mapWalletPayoutRequest(snapshot: QueryDocumentSnapshot<DocumentData>): WalletPayoutRequest {
  const data = snapshot.data() as Partial<WalletPayoutRequestDocument>;

  return {
    id: snapshot.id,
    requestNumber: toText(data.requestNumber, 100) || snapshot.id,
    amount: toRoundedAmount(toNumber(data.amount)),
    status: (toText(data.status, 40) as WalletPayoutRequest["status"]) || "requested",
    createdAt: timestampToIso(data.createdAt) || timestampToIso(snapshot.createTime),
    updatedAt: timestampToIso(data.updatedAt) || timestampToIso(data.createdAt) || timestampToIso(snapshot.updateTime),
    customerName: toText(data.customerName, 120),
    customerEmail: toText(data.customerEmail, 160),
    payoutMethod: (toText(data.payoutMethod, 40) as WalletPayoutRequest["payoutMethod"]) || "upi",
    accountHolderName: toText(data.accountHolderName, 120),
    upiId: toText(data.upiId, 120),
    bankName: toText(data.bankName, 120),
    bankAccountNumber: toText(data.bankAccountNumber, 80),
    ifscCode: toText(data.ifscCode, 40).toUpperCase(),
    note: toText(data.note, 500),
    adminNote: toText(data.adminNote, 500),
    transferReference: toText(data.transferReference, 120),
  };
}

function normalizePayoutInput(input: WalletPayoutInput): WalletPayoutInput {
  return {
    payoutMethod: input.payoutMethod,
    accountHolderName: toText(input.accountHolderName, 120),
    upiId: toText(input.upiId, 120).toLowerCase(),
    bankName: toText(input.bankName, 120),
    bankAccountNumber: toText(input.bankAccountNumber, 40).replace(/\s/g, ""),
    ifscCode: toText(input.ifscCode, 20).toUpperCase().replace(/\s/g, ""),
    note: toText(input.note, 500),
  };
}

function validatePayoutInput(input: WalletPayoutInput): WalletPayoutCreateResult | null {
  const normalized = normalizePayoutInput(input);
  if (!normalized.accountHolderName) {
    return {
      ok: false,
      code: "invalid-details",
      message: "Account holder name is required.",
    };
  }

  if (normalized.payoutMethod === "upi") {
    const upiPattern = /^[a-z0-9.\-_]{2,256}@[a-z]{2,64}$/i;
    if (!upiPattern.test(normalized.upiId)) {
      return {
        ok: false,
        code: "invalid-details",
        message: "Enter a valid UPI ID.",
      };
    }
    return null;
  }

  const accountPattern = /^\d{9,18}$/;
  const ifscPattern = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!normalized.bankName || !accountPattern.test(normalized.bankAccountNumber) || !ifscPattern.test(normalized.ifscCode)) {
    return {
      ok: false,
      code: "invalid-details",
      message: "Enter valid bank transfer details.",
    };
  }

  return null;
}

async function resolveWalletDocument(
  transaction: Transaction,
  db: Firestore,
  userId: string,
  nowIso: string,
): Promise<{ ref: DocumentReference<DocumentData>; data: WalletDocument }> {
  const preferredRef = walletsCollection(db).doc(userId);
  const preferredSnapshot = await transaction.get(preferredRef);
  if (preferredSnapshot.exists) {
    const data = preferredSnapshot.data() as Partial<WalletDocument>;
    return {
      ref: preferredRef,
      data: {
        userId,
        balance: toRoundedAmount(toNumber(data.balance)),
        reservedBalance: toRoundedAmount(toNumber(data.reservedBalance)),
        createdAt: timestampToIso(data.createdAt) || nowIso,
        updatedAt: timestampToIso(data.updatedAt) || nowIso,
      },
    };
  }

  const legacyQuery = walletsCollection(db).where("userId", "==", userId).limit(1);
  const legacySnapshot = await transaction.get(legacyQuery);
  const legacyDoc = legacySnapshot.docs[0];
  if (legacyDoc) {
    const data = legacyDoc.data() as Partial<WalletDocument>;
    return {
      ref: legacyDoc.ref,
      data: {
        userId,
        balance: toRoundedAmount(toNumber(data.balance)),
        reservedBalance: toRoundedAmount(toNumber(data.reservedBalance)),
        createdAt: timestampToIso(data.createdAt) || nowIso,
        updatedAt: timestampToIso(data.updatedAt) || nowIso,
      },
    };
  }

  const emptyWallet: WalletDocument = {
    userId,
    balance: 0,
    reservedBalance: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  transaction.set(preferredRef, emptyWallet);
  return { ref: preferredRef, data: emptyWallet };
}

async function fetchTransactionsByPayoutRequestId(
  transaction: Transaction,
  db: Firestore,
  payoutRequestId: string,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const query = walletTransactionsCollection(db)
    .where("payoutRequestId", "==", payoutRequestId)
    .where("type", "==", "refund_credit");
  const snapshot = await transaction.get(query);
  return snapshot.docs;
}

function getRequestStatusNotificationCopy(status: WalletPayoutRequest["status"], requestNumber: string): { title: string; body: string } {
  if (status === "processing") {
    return {
      title: "Refund Wallet transfer is being processed",
      body: `Your transfer request ${requestNumber} is now being processed by the NaariThread team.`,
    };
  }

  if (status === "paid") {
    return {
      title: "Refund Wallet transfer completed",
      body: `Your transfer request ${requestNumber} has been completed. Please check your destination account.`,
    };
  }

  if (status === "rejected") {
    return {
      title: "Refund Wallet transfer needs attention",
      body: `Your transfer request ${requestNumber} was not approved. The amount has been moved back to your Refund Wallet.`,
    };
  }

  return {
    title: "Refund Wallet transfer cancelled",
    body: `Your transfer request ${requestNumber} was cancelled and the amount is available again in your Refund Wallet.`,
  };
}

export async function listWalletSummary(args: { userId: string }): Promise<WalletSummary> {
  const userId = args.userId.trim();
  if (!userId) {
    return {
      balance: 0,
      availableToTransfer: 0,
      pendingTransferAmount: 0,
      nextEligibleAt: "",
      hasOpenPayoutRequest: false,
      transactions: [],
      payoutRequests: [],
    };
  }

  const db = getAdminDb();
  const [walletSnapshot, transactionsSnapshot, payoutRequestsSnapshot] = await Promise.all([
    walletsCollection(db).doc(userId).get(),
    walletTransactionsCollection(db)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(40)
      .get(),
    walletPayoutRequestsCollection(db)
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(10)
      .get(),
  ]);

  const transactions = transactionsSnapshot.docs.map(mapWalletTransaction);
  const payoutRequests = payoutRequestsSnapshot.docs.map(mapWalletPayoutRequest);
  const walletData = walletSnapshot.data() as Partial<WalletDocument> | undefined;
  const nowIso = new Date().toISOString();

  const availableTransactions = transactions.filter(
    (transaction) =>
      transaction.type === "refund_credit" &&
      transaction.withdrawalStatus === "available" &&
      transaction.maturityAt !== "" &&
      transaction.maturityAt <= nowIso,
  );
  const futureTransactions = transactions
    .filter(
      (transaction) =>
        transaction.type === "refund_credit" &&
        transaction.withdrawalStatus === "available" &&
        transaction.maturityAt !== "" &&
        transaction.maturityAt > nowIso,
    )
    .sort((left, right) => left.maturityAt.localeCompare(right.maturityAt));

  return {
    balance: toRoundedAmount(toNumber(walletData?.balance)),
    availableToTransfer: toRoundedAmount(availableTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)),
    pendingTransferAmount: toRoundedAmount(toNumber(walletData?.reservedBalance)),
    nextEligibleAt: futureTransactions[0]?.maturityAt ?? "",
    hasOpenPayoutRequest: payoutRequests.some((request) => request.status === "requested" || request.status === "processing"),
    transactions,
    payoutRequests,
  };
}

export async function creditRefundToWallet(args: {
  userId: string;
  orderId: string;
  amount: number;
  source: string;
}): Promise<{ alreadyCredited: boolean; creditedAmount: number; balance: number }> {
  const creditAmount = toRoundedAmount(args.amount);
  if (creditAmount <= 0) {
    throw new Error("Invalid refund amount.");
  }

  const db = getAdminDb();
  const result = await db.runTransaction(async (transaction) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const userId = args.userId.trim();
    const orderId = args.orderId.trim();

    const existingRefundQuery = walletTransactionsCollection(db)
      .where("userId", "==", userId)
      .where("referenceOrderId", "==", orderId)
      .where("type", "==", "refund_credit")
      .limit(1);
    const existingRefundSnapshot = await transaction.get(existingRefundQuery);
    if (!existingRefundSnapshot.empty) {
      const wallet = await resolveWalletDocument(transaction, db, userId, nowIso);
      return {
        alreadyCredited: true,
        creditedAmount: creditAmount,
        balance: wallet.data.balance,
      };
    }

    const wallet = await resolveWalletDocument(transaction, db, userId, nowIso);
    const nextBalance = toRoundedAmount(wallet.data.balance + creditAmount);
    const transactionRef = walletTransactionsCollection(db).doc();

    transaction.set(transactionRef, {
      userId,
      type: "refund_credit",
      amount: creditAmount,
      source: toText(args.source, 300) || `Refund for ${orderId}`,
      referenceOrderId: orderId,
      createdAt: nowIso,
      updatedAt: nowIso,
      maturityAt: buildMaturityAt(now),
      withdrawalStatus: "available",
      payoutRequestId: "",
      payoutRequestNumber: "",
    } satisfies WalletTransactionDocument);
    transaction.update(wallet.ref, {
      userId,
      balance: nextBalance,
      reservedBalance: wallet.data.reservedBalance,
      updatedAt: nowIso,
    });

    return {
      alreadyCredited: false,
      creditedAmount: creditAmount,
      balance: nextBalance,
    };
  });

  return result;
}

export async function createRefundWalletPayoutRequest(args: {
  userId: string;
  customerName: string;
  customerEmail: string;
  input: WalletPayoutInput;
}): Promise<WalletPayoutCreateResult> {
  const normalizedInput = normalizePayoutInput(args.input);
  const validationError = validatePayoutInput(normalizedInput);
  if (validationError) {
    return validationError;
  }

  const db = getAdminDb();
  const outcome = await db.runTransaction(async (transaction) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const userId = args.userId.trim();
    const wallet = await resolveWalletDocument(transaction, db, userId, nowIso);

    const openRequestsQuery = walletPayoutRequestsCollection(db)
      .where("userId", "==", userId)
      .where("status", "in", ["requested", "processing"]);
    const openRequestsSnapshot = await transaction.get(openRequestsQuery);
    if (!openRequestsSnapshot.empty) {
      return {
        ok: false,
        code: "already-requested",
        message: "A transfer request is already active for this Refund Wallet.",
      } satisfies WalletPayoutCreateResult;
    }

    const eligibleCreditsQuery = walletTransactionsCollection(db)
      .where("userId", "==", userId)
      .where("type", "==", "refund_credit")
      .where("withdrawalStatus", "==", "available")
      .where("maturityAt", "<=", nowIso);
    const eligibleCreditsSnapshot = await transaction.get(eligibleCreditsQuery);
    const eligibleCredits = eligibleCreditsSnapshot.docs.map(mapWalletTransaction);
    const eligibleAmount = toRoundedAmount(eligibleCredits.reduce((sum, credit) => sum + credit.amount, 0));

    if (eligibleAmount <= 0) {
      return {
        ok: false,
        code: "nothing-eligible",
        message: "No Refund Wallet credit is eligible for transfer yet.",
      } satisfies WalletPayoutCreateResult;
    }

    const requestRef = walletPayoutRequestsCollection(db).doc();
    const requestNumber = buildRequestNumber(now);

    transaction.set(requestRef, {
      userId,
      requestNumber,
      amount: eligibleAmount,
      status: "requested",
      createdAt: nowIso,
      updatedAt: nowIso,
      customerName: toText(args.customerName, 120),
      customerEmail: toText(args.customerEmail, 160).toLowerCase(),
      payoutMethod: normalizedInput.payoutMethod,
      accountHolderName: normalizedInput.accountHolderName,
      upiId: normalizedInput.upiId,
      bankName: normalizedInput.bankName,
      bankAccountNumber: normalizedInput.bankAccountNumber,
      ifscCode: normalizedInput.ifscCode,
      note: normalizedInput.note,
      adminNote: "",
      transferReference: "",
    } satisfies WalletPayoutRequestDocument);

    for (const creditSnapshot of eligibleCreditsSnapshot.docs) {
      transaction.update(creditSnapshot.ref, {
        withdrawalStatus: "reserved",
        payoutRequestId: requestRef.id,
        payoutRequestNumber: requestNumber,
        updatedAt: nowIso,
      });
    }

    transaction.update(wallet.ref, {
      reservedBalance: toRoundedAmount(wallet.data.reservedBalance + eligibleAmount),
      updatedAt: nowIso,
    });

    return {
      ok: true,
      requestId: requestRef.id,
      requestNumber,
      amount: eligibleAmount,
    } satisfies WalletPayoutCreateResult;
  });

  if (outcome.ok) {
    await createUserNotification({
      userId: args.userId.trim(),
      title: "Refund Wallet transfer requested",
      body: `Your request ${outcome.requestNumber} for Rs ${outcome.amount.toLocaleString("en-IN")} has been submitted. The team will review it shortly.`,
      type: "wallet",
      metadata: {
        payoutRequestId: outcome.requestId,
        requestNumber: outcome.requestNumber,
        amount: outcome.amount,
      },
    }).catch(() => undefined);
  }

  return outcome;
}

export async function updateRefundWalletPayoutStatus(args: {
  payoutRequestId: string;
  nextStatus: "processing" | "paid" | "rejected" | "cancelled";
  adminNote: string;
  transferReference: string;
}): Promise<WalletPayoutStatusUpdateResult> {
  const db = getAdminDb();
  const payoutRequestId = args.payoutRequestId.trim();
  if (!payoutRequestId) {
    return {
      ok: false,
      code: "not-found",
      message: "Missing payout request id.",
    };
  }

  const outcome = await db.runTransaction(async (transaction) => {
    const nowIso = new Date().toISOString();
    const requestRef = walletPayoutRequestsCollection(db).doc(payoutRequestId);
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) {
      return {
        ok: false,
        code: "not-found",
        message: "Payout request not found.",
      } satisfies WalletPayoutStatusUpdateResult;
    }

    const request = mapWalletPayoutRequest(requestSnapshot as QueryDocumentSnapshot<DocumentData>);
    const requestData = requestSnapshot.data() as Partial<WalletPayoutRequestDocument>;
    const requestUserId = toText(requestData.userId, 120);
    if (!requestUserId) {
      return {
        ok: false,
        code: "not-found",
        message: "Payout request is missing user ownership.",
      } satisfies WalletPayoutStatusUpdateResult;
    }
    const currentStatus = request.status;
    const allowedTransitions: Record<WalletPayoutRequest["status"], WalletPayoutRequest["status"][]> = {
      requested: ["processing", "paid", "rejected", "cancelled"],
      processing: ["paid", "rejected", "cancelled"],
      paid: [],
      rejected: [],
      cancelled: [],
    };

    if (!allowedTransitions[currentStatus].includes(args.nextStatus)) {
      return {
        ok: false,
        code: "invalid-transition",
        message: "This payout request cannot move to the selected status.",
      } satisfies WalletPayoutStatusUpdateResult;
    }

    const creditSnapshots = await fetchTransactionsByPayoutRequestId(transaction, db, payoutRequestId);
    const amount = toRoundedAmount(creditSnapshots.reduce((sum, snapshot) => sum + toNumber(snapshot.data().amount), 0));
    const wallet = await resolveWalletDocument(transaction, db, requestUserId, nowIso);

    if (args.nextStatus === "paid") {
      for (const creditSnapshot of creditSnapshots) {
        transaction.update(creditSnapshot.ref, {
          type: "withdrawal_paid",
          withdrawalStatus: "paid_out",
          updatedAt: nowIso,
        });
      }

      transaction.update(wallet.ref, {
        balance: toRoundedAmount(Math.max(0, wallet.data.balance - amount)),
        reservedBalance: toRoundedAmount(Math.max(0, wallet.data.reservedBalance - amount)),
        updatedAt: nowIso,
      });
    }

    if (args.nextStatus === "rejected" || args.nextStatus === "cancelled") {
      for (const creditSnapshot of creditSnapshots) {
        transaction.update(creditSnapshot.ref, {
          type: "withdrawal_released",
          withdrawalStatus: "available",
          updatedAt: nowIso,
        });
      }

      transaction.update(wallet.ref, {
        reservedBalance: toRoundedAmount(Math.max(0, wallet.data.reservedBalance - amount)),
        updatedAt: nowIso,
      });
    }

    if (args.nextStatus === "processing") {
      transaction.update(wallet.ref, {
        updatedAt: nowIso,
      });
    }

    transaction.update(requestRef, {
      status: args.nextStatus,
      adminNote: toText(args.adminNote, 500),
      transferReference: toText(args.transferReference, 120),
      updatedAt: nowIso,
    });

    return {
      ok: true,
      nextStatus: args.nextStatus,
      requestNumber: request.requestNumber,
      amount,
      userId: requestUserId,
    } satisfies WalletPayoutStatusUpdateResult;
  });

  if (outcome.ok) {
    const notificationCopy = getRequestStatusNotificationCopy(outcome.nextStatus, outcome.requestNumber);
    await createUserNotification({
      userId: outcome.userId,
      title: notificationCopy.title,
      body: notificationCopy.body,
      type: "wallet",
      metadata: {
        requestNumber: outcome.requestNumber,
        amount: outcome.amount,
        status: outcome.nextStatus,
      },
    }).catch(() => undefined);
  }

  return outcome;
}

export async function listRefundWalletPayoutRequests(): Promise<WalletPayoutRequest[]> {
  const db = getAdminDb();
  const snapshot = await walletPayoutRequestsCollection(db)
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  return snapshot.docs.map(mapWalletPayoutRequest);
}

export async function incrementWalletRefundBalance(args: {
  userId: string;
  amount: number;
  reason: string;
  referenceOrderId: string;
}): Promise<{ alreadyCredited: boolean; creditedAmount: number; balance: number }> {
  return creditRefundToWallet({
    userId: args.userId,
    amount: args.amount,
    source: args.reason,
    orderId: args.referenceOrderId,
  });
}
