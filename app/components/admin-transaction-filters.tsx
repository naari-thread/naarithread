"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

type Props = {
  tab: string;
  q: string;
  period: string;
  statuses?: string[];
};

const ORDER_STATUS_OPTIONS = [
  { value: "initiated", label: "Initiated" },
  { value: "placed", label: "Placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "shipped", label: "Shipped" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded_to_wallet", label: "Refunded to Wallet" },
];

const PERIOD_OPTIONS = [
  { value: "", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: String(new Date().getFullYear()), label: String(new Date().getFullYear()) },
  { value: String(new Date().getFullYear() - 1), label: String(new Date().getFullYear() - 1) },
];

export function AdminTransactionFilters({ tab, q, period, statuses }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedStatuses = statuses ?? [];

  function buildHref(newQ: string, newPeriod: string, newStatuses: string[]) {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (newQ) params.set("q", newQ);
    if (newPeriod) params.set("period", newPeriod);
    if (newStatuses.length > 0) params.set("status", newStatuses.join(","));
    return `/admin?${params.toString()}`;
  }

  function handlePeriodChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const currentQ = inputRef.current?.value.trim() ?? q;
    router.push(buildHref(currentQ, event.target.value, selectedStatuses));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentQ = inputRef.current?.value.trim() ?? "";
    router.push(buildHref(currentQ, period, selectedStatuses));
  }

  function toggleStatus(value: string) {
    const next = selectedStatuses.includes(value)
      ? selectedStatuses.filter((s) => s !== value)
      : [...selectedStatuses, value];
    const currentQ = inputRef.current?.value.trim() ?? q;
    router.push(buildHref(currentQ, period, next));
  }

  return (
    <div className="mt-3 space-y-2.5">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2"
        aria-label="Filter transactions"
      >
        {/* Search with icon inside */}
        <div className="relative flex-1 min-w-0">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-primary/40">
            <DynamicHugeIcon name="Search01Icon" className="h-4.5 w-4.5" iconStrokeWidth={2} />
          </span>
          <input
            ref={inputRef}
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search order no, email, status…"
            aria-label="Search transactions"
            className="h-10 w-full rounded-xl border border-primary/20 bg-paper pl-9 pr-3 text-sm outline-none transition focus:border-primary"
          />
        </div>

        {/* Date dropdown */}
        <div className="relative shrink-0">
          <select
            value={period}
            onChange={handlePeriodChange}
            aria-label="Filter by date period"
            className="h-10 appearance-none rounded-xl border border-primary/20 bg-paper pl-3 pr-8 text-sm text-primary/80 outline-none transition focus:border-primary"
          >
            {PERIOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-primary/45">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </form>

      {/* Status chips — orders tab only */}
      {tab === "orders" && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by order status">
          {ORDER_STATUS_OPTIONS.map((opt) => {
            const active = selectedStatuses.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleStatus(opt.value)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] transition ${
                  active
                    ? "border-primary bg-primary text-paper"
                    : "border-primary/20 bg-paper text-primary/65 hover:border-primary/40 hover:text-primary/85"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {selectedStatuses.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const currentQ = inputRef.current?.value.trim() ?? q;
                router.push(buildHref(currentQ, period, []));
              }}
              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-red-600 transition hover:bg-red-100"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
