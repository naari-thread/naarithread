"use client";

import { useEffect, type ReactNode } from "react";
import { toast } from "sonner";

type AdminActionToastProps = {
  message: string;
  tone?: "success" | "info" | "error";
  clearParams?: readonly string[];
};

const ADMIN_ACTION_TOAST_ID = "admin-action-notice";
const DEFAULT_CLEAR_PARAMS = ["notice"] as const;

export function AdminActionToast({
  message,
  tone = "success",
  clearParams = DEFAULT_CLEAR_PARAMS,
}: AdminActionToastProps): ReactNode {
  const clearParamKey = clearParams.join(",");

  useEffect(() => {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return;
    }

    toast[tone](normalizedMessage, { id: ADMIN_ACTION_TOAST_ID });

    const currentUrl = new URL(window.location.href);
    for (const param of clearParamKey.split(",")) {
      currentUrl.searchParams.delete(param);
    }
    window.history.replaceState(
      window.history.state,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
    );
  }, [clearParamKey, message, tone]);

  return null;
}
