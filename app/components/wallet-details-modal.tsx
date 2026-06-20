"use client";

import { type ReactElement, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type WalletTransaction = {
  id: string;
  type: "refund_credit" | "withdrawal_paid" | "withdrawal_released";
  amount: number;
  source: string;
  date: string;
  maturityAt: string;
  withdrawalStatus: "available" | "reserved" | "paid_out";
  payoutRequestId: string;
  payoutRequestNumber: string;
};

type WalletPayoutRequest = {
  id: string;
  requestNumber: string;
  amount: number;
  status: "requested" | "processing" | "paid" | "rejected" | "cancelled";
  createdAt: string;
  updatedAt: string;
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

type WalletResponse = {
  balance: number;
  availableToTransfer: number;
  pendingTransferAmount: number;
  nextEligibleAt: string;
  hasOpenPayoutRequest: boolean;
  transactions: WalletTransaction[];
  payoutRequests: WalletPayoutRequest[];
  error?: string;
};

type WalletDetailsModalProps = {
  onClose?: () => void;
};

type PayoutFormState = {
  payoutMethod: "upi" | "bank_transfer";
  accountHolderName: string;
  upiId: string;
  bankName: string;
  bankAccountNumber: string;
  ifscCode: string;
  note: string;
};

const DEFAULT_FORM: PayoutFormState = {
  payoutMethod: "upi",
  accountHolderName: "",
  upiId: "",
  bankName: "",
  bankAccountNumber: "",
  ifscCode: "",
  note: "",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.max(0, amount));
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getRequestStatusPill(status: WalletPayoutRequest["status"]): string {
  if (status === "paid") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "processing") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "requested") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-red-200 bg-red-50 text-red-700";
}

function getTransactionPresentation(transaction: WalletTransaction): {
  title: string;
  toneClass: string;
  icon: "Add01Icon" | "Remove01Icon";
  amountPrefix: "+" | "-";
} {
  if (transaction.type === "refund_credit") {
    return {
      title: transaction.withdrawalStatus === "reserved"
        ? "Reserved for transfer request"
        : "Refund credited",
      toneClass: "bg-emerald-100 text-emerald-700",
      icon: "Add01Icon",
      amountPrefix: "+",
    };
  }

  if (transaction.type === "withdrawal_paid") {
    return {
      title: "Transferred to your account",
      toneClass: "bg-primary/10 text-primary",
      icon: "Remove01Icon",
      amountPrefix: "-",
    };
  }

  return {
    title: "Transfer request released back",
    toneClass: "bg-orange-100 text-orange-700",
    icon: "Add01Icon",
    amountPrefix: "+",
  };
}

export function WalletDetailsModal(props: WalletDetailsModalProps): ReactElement {
  void props;
  const { user, createAuthJwt } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<PayoutFormState>(DEFAULT_FORM);

  const openRequest = useMemo(() => {
    return wallet?.payoutRequests.find((request) => request.status === "requested" || request.status === "processing") ?? null;
  }, [wallet?.payoutRequests]);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchWalletData = async (): Promise<void> => {
      try {
        const jwt = await createAuthJwt();
        const response = await fetch("/api/account/wallet", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        const payload = (await response.json()) as WalletResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load Refund Wallet.");
        }

        setWallet(payload);
        setError(null);
      } catch (fetchError) {
        console.error("Failed to load refund wallet:", fetchError);
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load Refund Wallet.");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchWalletData();
  }, [createAuthJwt, user]);

  async function reloadWallet(): Promise<void> {
    if (!user) return;
    const jwt = await createAuthJwt();
    const response = await fetch("/api/account/wallet", {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const payload = (await response.json()) as WalletResponse;
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to reload Refund Wallet.");
    }
    setWallet(payload);
  }

  async function handleRequestPayout(): Promise<void> {
    if (!user || !wallet || wallet.availableToTransfer <= 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const jwt = await createAuthJwt();
      const response = await fetch("/api/account/wallet/request-payout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { ok?: boolean; requestNumber?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to submit Refund Wallet transfer request.");
      }

      toast.success(`Transfer request ${payload.requestNumber ?? ""} created.`);
      setShowRequestForm(false);
      setForm(DEFAULT_FORM);
      await reloadWallet();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : "Could not submit request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
        <p className="text-xs text-primary/70">Sign in to view your Refund Wallet.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <div className="inline-flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs text-primary/60">Loading Refund Wallet...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4 px-1 pb-1 sm:px-2 sm:pb-2">
      <div className="rounded-2xl border border-primary/16 bg-gradient-to-br from-primary/[0.04] via-secondary to-primary/[0.08] p-4">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">Refund Wallet</p>
        <h3 className="mt-2 text-2xl font-bold text-primary">{formatCurrency(wallet?.balance ?? 0)}</h3>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/12 bg-paper p-3">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary/52">Available to transfer</p>
            <p className="mt-1 text-lg font-semibold text-primary">{formatCurrency(wallet?.availableToTransfer ?? 0)}</p>
          </div>
          <div className="rounded-xl border border-primary/12 bg-paper p-3">
            <p className="text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-primary/52">Pending transfer</p>
            <p className="mt-1 text-lg font-semibold text-primary">{formatCurrency(wallet?.pendingTransferAmount ?? 0)}</p>
          </div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-primary/68">
          Refund credits become eligible for transfer 7 days after they are added. Once requested, the amount stays reserved until the NaariThread team marks it paid or releases it back.
        </p>
        {wallet?.nextEligibleAt ? (
          <p className="mt-2 text-[0.72rem] text-primary/62">
            Next eligible credit unlocks on {formatDateTime(wallet.nextEligibleAt)}.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-primary/14 bg-paper p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">Transfer request</p>
            <p className="mt-1 text-sm text-primary/78">Move eligible Refund Wallet credit to your UPI or bank account.</p>
          </div>
          <button
            type="button"
            aria-label="Toggle transfer request form"
            onClick={() => setShowRequestForm((current) => !current)}
            disabled={Boolean(openRequest) || (wallet?.availableToTransfer ?? 0) <= 0}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-primary/18 bg-primary px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-secondary transition disabled:cursor-not-allowed disabled:opacity-45"
          >
            {openRequest ? "Request open" : "Request transfer"}
          </button>
        </div>

        {openRequest ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${getRequestStatusPill(openRequest.status)}`}>
                {openRequest.status.replace(/_/g, " ")}
              </span>
              <span className="text-xs font-semibold text-primary/70">{openRequest.requestNumber}</span>
            </div>
            <p className="mt-2 text-sm text-primary">
              {formatCurrency(openRequest.amount)} is currently reserved for this transfer request.
            </p>
          </div>
        ) : null}

        {showRequestForm ? (
          <div className="mt-3 space-y-3 rounded-xl border border-primary/12 bg-secondary/65 p-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-label="Request transfer through UPI"
                onClick={() => setForm((current) => ({ ...current, payoutMethod: "upi" }))}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${form.payoutMethod === "upi" ? "border-primary bg-primary text-secondary" : "border-primary/16 bg-paper text-primary/75"}`}
              >
                UPI
              </button>
              <button
                type="button"
                aria-label="Request transfer through bank account"
                onClick={() => setForm((current) => ({ ...current, payoutMethod: "bank_transfer" }))}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] ${form.payoutMethod === "bank_transfer" ? "border-primary bg-primary text-secondary" : "border-primary/16 bg-paper text-primary/75"}`}
              >
                Bank
              </button>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Account holder</span>
              <input
                aria-label="Account holder name"
                value={form.accountHolderName}
                onChange={(event) => setForm((current) => ({ ...current, accountHolderName: event.target.value }))}
                className="h-11 rounded-xl border border-primary/16 bg-paper px-3 text-sm text-primary outline-none"
              />
            </label>

            {form.payoutMethod === "upi" ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">UPI ID</span>
                <input
                  aria-label="UPI ID"
                  value={form.upiId}
                  onChange={(event) => setForm((current) => ({ ...current, upiId: event.target.value }))}
                  placeholder="name@bank"
                  className="h-11 rounded-xl border border-primary/16 bg-paper px-3 text-sm text-primary outline-none"
                />
              </label>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Bank name</span>
                  <input
                    aria-label="Bank name"
                    value={form.bankName}
                    onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))}
                    className="h-11 rounded-xl border border-primary/16 bg-paper px-3 text-sm text-primary outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Account no.</span>
                  <input
                    aria-label="Bank account number"
                    value={form.bankAccountNumber}
                    onChange={(event) => setForm((current) => ({ ...current, bankAccountNumber: event.target.value }))}
                    className="h-11 rounded-xl border border-primary/16 bg-paper px-3 text-sm text-primary outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">IFSC</span>
                  <input
                    aria-label="IFSC code"
                    value={form.ifscCode}
                    onChange={(event) => setForm((current) => ({ ...current, ifscCode: event.target.value.toUpperCase() }))}
                    className="h-11 rounded-xl border border-primary/16 bg-paper px-3 text-sm text-primary outline-none"
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-primary/58">Note for team</span>
              <textarea
                aria-label="Transfer request note"
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                rows={3}
                className="rounded-xl border border-primary/16 bg-paper px-3 py-2 text-sm text-primary outline-none"
              />
            </label>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                aria-label="Submit transfer request"
                onClick={() => void handleRequestPayout()}
                disabled={isSubmitting}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-primary bg-primary px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-secondary transition disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isSubmitting ? "Submitting..." : `Request ${formatCurrency(wallet?.availableToTransfer ?? 0)}`}
              </button>
              <button
                type="button"
                aria-label="Cancel transfer request form"
                onClick={() => setShowRequestForm(false)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-primary/18 bg-paper px-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary/76"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">Recent transfer requests</p>
        {wallet?.payoutRequests.length ? (
          <div className="space-y-2">
            {wallet.payoutRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-primary/12 bg-paper p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">{request.requestNumber}</p>
                    <p className="mt-0.5 text-xs text-primary/64">{formatDateTime(request.createdAt)}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${getRequestStatusPill(request.status)}`}>
                    {request.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-primary">{formatCurrency(request.amount)}</p>
                <p className="mt-1 text-xs text-primary/68">
                  {request.payoutMethod === "upi"
                    ? `UPI: ${request.upiId || "Not provided"}`
                    : `Bank: ${request.bankName || "Bank transfer"}${request.ifscCode ? ` / ${request.ifscCode}` : ""}`}
                </p>
                {request.transferReference ? (
                  <p className="mt-1 text-xs text-primary/68">Reference: {request.transferReference}</p>
                ) : null}
                {request.adminNote ? (
                  <p className="mt-1 text-xs text-primary/68">Team note: {request.adminNote}</p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-primary/12 bg-paper p-4">
            <p className="text-sm text-primary/68">No transfer requests yet.</p>
          </div>
        )}
      </section>

      <section>
        <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-primary/58">Refund history</p>
        {wallet?.transactions.length ? (
          <div className="space-y-2">
            {wallet.transactions.map((transaction) => {
              const presentation = getTransactionPresentation(transaction);
              return (
                <article key={transaction.id} className="rounded-xl border border-primary/12 bg-paper p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${presentation.toneClass}`}>
                        <DynamicHugeIcon name={presentation.icon} className="h-4 w-4" iconStrokeWidth={2.2} aria-hidden={true} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary">{presentation.title}</p>
                        <p className="mt-0.5 text-xs text-primary/66">{transaction.source}</p>
                        <p className="mt-1 text-[0.68rem] text-primary/58">{formatDateTime(transaction.date)}</p>
                        {transaction.type === "refund_credit" && transaction.withdrawalStatus === "available" && transaction.maturityAt ? (
                          <p className="mt-1 text-[0.68rem] text-primary/58">Eligible on {formatDateTime(transaction.maturityAt)}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">
                        {presentation.amountPrefix}{formatCurrency(transaction.amount)}
                      </p>
                      {transaction.payoutRequestNumber ? (
                        <p className="mt-1 text-[0.68rem] text-primary/56">{transaction.payoutRequestNumber}</p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-primary/12 bg-paper p-4">
            <p className="text-sm text-primary/68">No Refund Wallet activity yet.</p>
          </div>
        )}
      </section>
    </div>
  );
}
