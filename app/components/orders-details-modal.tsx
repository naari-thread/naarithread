"use client";

import { useAuth } from "@/app/components/auth-provider";

type OrdersDetailsModalProps = {
  onClose?: () => void;
};

export function OrdersDetailsModal({ onClose }: OrdersDetailsModalProps) {
  const { user } = useAuth();
  void onClose;

  if (!user) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
        <p className="text-xs text-primary/70">Sign in to view your orders.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-h-[60vh] overflow-y-auto overscroll-contain space-y-3 px-1 pb-1 sm:px-2 sm:pb-2">
      <div className="rounded-xl border border-primary/12 bg-primary/[0.03] p-4">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary/62">Orders</p>
        <p className="mt-2 text-sm font-medium text-primary">No order history available yet.</p>
        {/* TODO: Replace this empty state with real order history once order APIs/collection are available. */}
        <p className="mt-1 text-xs text-primary/70">Your recent orders will appear here once available.</p>
      </div>
    </div>
  );
}
