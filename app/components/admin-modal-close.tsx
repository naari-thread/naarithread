"use client";

import Link from "next/link";
import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";

export function AdminModalClose({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Close"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 text-primary/60 transition hover:border-primary/45 hover:text-primary"
    >
      <DynamicHugeIcon name="Cancel01Icon" className="h-4.5 w-4.5" iconStrokeWidth={2.2} />
    </Link>
  );
}
