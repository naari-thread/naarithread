"use client";

import { useMemo, useRef } from "react";
import { motion } from "framer-motion";

type AnimatedOtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
};

export function AnimatedOtpInput({ value, onChange, length = 6, disabled = false }: AnimatedOtpInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const normalized = useMemo(
    () => value.replace(/\D/g, "").slice(0, length).padEnd(length, " "),
    [length, value]
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" aria-label="One-time password fields">
      {Array.from({ length }, (_, index) => {
        const cellValue = normalized[index] === " " ? "" : normalized[index];

        return (
          <motion.input
            key={`otp-cell-${index}`}
            ref={(element) => {
              inputRefs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={cellValue}
            disabled={disabled}
            aria-label={`OTP digit ${index + 1}`}
            whileFocus={{ scale: 1.04 }}
            onChange={(event) => {
              const digit = event.target.value.replace(/\D/g, "").slice(-1);
              const next = normalized.split("");
              next[index] = digit || " ";

              onChange(next.join("").trim());

              if (digit && index < length - 1) {
                inputRefs.current[index + 1]?.focus();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !cellValue && index > 0) {
                inputRefs.current[index - 1]?.focus();
              }
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
              if (!pasted) {
                return;
              }

              event.preventDefault();
              onChange(pasted);
              const focusIndex = Math.min(pasted.length, length - 1);
              inputRefs.current[focusIndex]?.focus();
            }}
            className="h-12 w-10 rounded-xl border border-primary/25 bg-paper text-center text-lg font-semibold text-primary outline-none transition focus:border-primary focus:shadow-[0_0_0_3px_rgba(120,0,0,0.16)] disabled:cursor-not-allowed disabled:opacity-60 sm:h-14 sm:w-11"
          />
        );
      })}
    </div>
  );
}
