"use client";

import { useState } from "react";

type Props = {
  orderId: string;
  returnTo: string;
  orderTitle: string;
};

export function AdminRefundConfirm({ orderId, returnTo, orderTitle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Refund order ${orderId} to wallet`}
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-emerald-700"
      >
        Refund to Wallet
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm wallet refund"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-primary/12 bg-paper p-6 shadow-xl">
            <p className="text-base font-semibold text-primary">Confirm wallet refund</p>
            <p className="mt-2 text-sm leading-relaxed text-primary/70">
              Refund <span className="font-medium text-primary">{orderTitle}</span> to the customer&rsquo;s wallet? This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-primary/20 py-2.5 text-sm font-medium text-primary/70"
              >
                Cancel
              </button>
              <form action="/api/admin/orders/refund-to-wallet" method="POST" className="flex-1">
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="reason" value="Admin approved wallet refund" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-emerald-300 bg-emerald-600 py-2.5 text-sm font-semibold text-white"
                >
                  Yes, Refund
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
