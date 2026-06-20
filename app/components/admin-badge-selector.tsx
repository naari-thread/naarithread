"use client";

import { useRef, useState } from "react";

type Badge = { value: string; label: string };

type Props = {
  badges: Badge[];
  defaultValue?: string;
};

export function AdminBadgeSelector({ badges: initialBadges, defaultValue = "" }: Props) {
  const [badges, setBadges] = useState<Badge[]>(initialBadges);
  const [selected, setSelected] = useState(defaultValue);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleCreate() {
    const label = inputValue.trim();
    if (!label) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/badges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = (await response.json()) as { value?: string; label?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Failed to create badge.");
        return;
      }
      const newBadge: Badge = { value: data.value!, label: data.label! };
      setBadges((prev) => {
        if (prev.some((b) => b.value === newBadge.value)) return prev;
        return [...prev, newBadge];
      });
      setSelected(newBadge.value);
      setInputValue("");
      setShowInput(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreate();
    }
    if (e.key === "Escape") {
      setShowInput(false);
      setInputValue("");
      setError(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden input so the native form picks up the value */}
      <input type="hidden" name="badge" value={selected} />

      <div className="flex items-center gap-2">
        <select
          aria-label="Product badge"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-11 flex-1 rounded-xl border border-primary/18 bg-paper px-3 text-sm"
        >
          <option value="">No badge</option>
          {badges.map((badge) => (
            <option key={badge.value} value={badge.value}>
              {badge.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setShowInput((v) => !v);
            setError(null);
            if (!showInput) {
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }}
          title="Add new badge"
          aria-label="Add new badge"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-paper text-primary/60 transition hover:border-primary/40 hover:text-primary"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>
      </div>

      {showInput && (
        <div className="rounded-xl border border-primary/14 bg-secondary/60 p-3">
          <p className="mb-2 text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-primary/60">
            New badge label
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Festival Special"'
              maxLength={60}
              className="h-9 flex-1 rounded-lg border border-primary/18 bg-paper px-3 text-sm outline-none transition focus:border-primary/40"
            />
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={isCreating || !inputValue.trim()}
              className="h-9 rounded-lg border border-primary bg-primary px-3 text-xs font-semibold uppercase tracking-[0.14em] text-paper transition disabled:opacity-40"
            >
              {isCreating ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => { setShowInput(false); setInputValue(""); setError(null); }}
              className="h-9 rounded-lg border border-primary/16 px-3 text-xs text-primary/60 transition hover:text-primary"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1.5 text-[0.68rem] text-red-600">{error}</p>}
          <p className="mt-1.5 text-[0.6rem] text-primary/45">
            The badge will be saved and available for all products.
          </p>
        </div>
      )}
    </div>
  );
}
