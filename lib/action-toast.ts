"use client";

import { toast } from "sonner";

export type ActionToastTone = "success" | "info" | "error";

type ActionToastOptions = {
  id: string;
  message: string;
  description?: string;
  tone?: ActionToastTone;
};

export function showActionToast({
  id,
  message,
  description,
  tone = "success",
}: ActionToastOptions): void {
  toast[tone](message, {
    id,
    ...(description ? { description } : {}),
  });
}
