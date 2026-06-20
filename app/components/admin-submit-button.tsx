"use client";

import { useFormStatus } from "react-dom";

type AdminSubmitButtonProps = {
  label: string;
  pendingLabel: string;
  ariaLabel: string;
  className?: string;
};

export function AdminSubmitButton({
  label,
  pendingLabel,
  ariaLabel,
  className = "cta-thread",
}: AdminSubmitButtonProps): React.JSX.Element {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={pending ? pendingLabel : ariaLabel}
      aria-disabled={pending}
      disabled={pending}
      className={`${className} inline-flex min-w-36 items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70`}
    >
      {pending ? (
        <span
          aria-hidden="true"
          className="size-3.5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
        />
      ) : null}
      <span>{pending ? pendingLabel : label}</span>
    </button>
  );
}
