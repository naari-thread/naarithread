"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth-provider";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type WalletTransaction = {
  id: string;
  type: "spent" | "refunded";
  amount: number;
  source: string;
  date: string;
};

type WalletDetailsModalProps = {
  onClose?: () => void;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function WalletDetailsModal(_props: WalletDetailsModalProps) {
  const { user, createAuthJwt } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchWalletData = async () => {
      try {
        const jwt = await createAuthJwt();
        const response = await fetch("/api/account/wallet", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
          },
        });

        const payload = (await response.json()) as {
          balance?: number;
          transactions?: WalletTransaction[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to fetch wallet");
        }

        setBalance(Math.max(0, Number(payload.balance ?? 0)));
        setTransactions(Array.isArray(payload.transactions) ? payload.transactions : []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch wallet data:", err);
        setError("Failed to load wallet data");
      } finally {
        setIsLoading(false);
      }
    };

    void fetchWalletData();
  }, [createAuthJwt, user]);

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return (
    <div className="flex flex-col max-h-[60vh] overflow-y-auto overscroll-contain space-y-4 px-1 pb-1 sm:px-2 sm:pb-2">
      {isLoading && transactions.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center">
          <div className="inline-flex flex-col items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <span className="text-xs text-primary/60">Loading wallet...</span>
          </div>
        </div>
      ) : (
        <>
          {/* Wallet Balance Card */}
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-3 sm:p-4 shrink-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/65 mb-1 sm:text-[0.62rem]">
              Available Balance
            </p>
            <h3 className="text-xl sm:text-2xl font-bold text-primary">
              {formatCurrency(balance)}
            </h3>
            <p className="mt-2 text-[0.65rem] sm:text-xs text-primary/60">
              Use this balance for your next purchase
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 shrink-0">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Transaction History */}
          <div className="shrink-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/65 mb-2 sm:text-[0.62rem]">
              Transaction History
            </p>

            {transactions.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-primary/10 bg-paper">
                <p className="text-xs sm:text-sm text-primary/60">No wallet history available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction, index) => (
                  <div key={transaction.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-2 sm:gap-3 rounded-lg border border-primary/10 bg-paper p-2.5 sm:p-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <div
                          className={`mt-0.5 inline-flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full ${
                            transaction.type === "refunded"
                              ? "bg-green-100"
                              : "bg-orange-100"
                          }`}
                        >
                          <DynamicHugeIcon
                            name={transaction.type === "refunded" ? "Add01Icon" : "Remove01Icon"}
                            className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                              transaction.type === "refunded"
                                ? "text-green-700"
                                : "text-orange-700"
                            }`}
                            iconStrokeWidth={2.5}
                            aria-hidden={true}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-semibold text-primary truncate">
                            {transaction.type === "refunded" ? "Refunded from" : "Spent on"}{" "}
                            {transaction.source}
                          </p>
                          <p className="text-[0.6rem] sm:text-xs text-primary/60 mt-0.5">
                            {new Date(transaction.date).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`text-xs sm:text-sm font-bold shrink-0 whitespace-nowrap ${
                          transaction.type === "refunded"
                            ? "text-green-700"
                            : "text-orange-700"
                        }`}
                      >
                        {transaction.type === "refunded" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>

                    {index < transactions.length - 1 && (
                      <div className="h-px bg-primary/8" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
