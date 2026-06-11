"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type AdminMultiSelectFieldProps = {
  name: string;
  label: string;
  options: string[];
  defaultValue?: string;
  allowCustom?: boolean;
  required?: boolean;
  /** When true, show inline chips (e.g. Sizes). When false, show a dropdown (e.g. Colors). */
  inline?: boolean;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Inline chip row — good for small fixed lists like Sizes (XS–3XL). */
function InlineChips({
  name,
  label,
  allOptions,
  selected,
  toggle,
  required,
}: {
  name: string;
  label: string;
  allOptions: string[];
  selected: string[];
  toggle: (v: string) => void;
  required: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={selected.join(", ")} required={required && selected.length === 0} />
      <div className="flex flex-wrap gap-1.5">
        {allOptions.length === 0 ? (
          <span className="text-xs text-primary/55">No options available.</span>
        ) : (
          allOptions.map((option) => {
            const isActive = selected.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggle(option)}
                aria-pressed={isActive}
                aria-label={`${isActive ? "Remove" : "Add"} ${option} for ${label}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-primary bg-primary text-paper"
                    : "border-primary/25 bg-paper text-primary/80 hover:border-primary/45"
                }`}
              >
                {option}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Dropdown multi-select — good for long lists like Colors. */
function DropdownMultiSelect({
  name,
  label,
  allOptions,
  selected,
  toggle,
  required,
  allowCustom,
  customDraft,
  setCustomDraft,
  addCustom,
}: {
  name: string;
  label: string;
  allOptions: string[];
  selected: string[];
  toggle: (v: string) => void;
  required: boolean;
  allowCustom: boolean;
  customDraft: string;
  setCustomDraft: (v: string) => void;
  addCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(
    () =>
      allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [allOptions, search]
  );

  const triggerLabel =
    selected.length === 0
      ? `Choose ${label.toLowerCase()}`
      : `${selected.length} selected`;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-2">
      <input type="hidden" name={name} value={selected.join(", ")} required={required && selected.length === 0} />

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Open ${label} picker`}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-primary/20 bg-paper px-3 text-sm text-primary/75 transition hover:border-primary/40"
      >
        <span className={selected.length > 0 ? "font-semibold text-primary" : ""}>{triggerLabel}</span>
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-primary/45 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Selected chips preview */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-primary/22 bg-paper px-2.5 py-1 text-xs font-semibold text-primary/85">
              {s}
              <button
                type="button"
                aria-label={`Remove ${s}`}
                onClick={() => toggle(s)}
                className="ml-0.5 text-primary/45 hover:text-primary"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      {/* Dropdown panel */}
      {open ? (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full rounded-2xl border border-primary/15 bg-secondary shadow-[0_12px_32px_rgba(40,0,0,0.16)]">
          {/* Search inside dropdown */}
          <div className="border-b border-primary/10 p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={`Search ${label.toLowerCase()}…`}
              aria-label={`Search ${label}`}
              className="h-9 w-full rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Scrollable options */}
          <div role="listbox" aria-multiselectable="true" aria-label={`${label} options`} className="max-h-52 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-primary/50">No matches</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {filtered.map((option) => {
                  const isActive = selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => toggle(option)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-primary bg-primary text-paper"
                          : "border-primary/22 bg-paper text-primary/80 hover:border-primary/45"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom color input */}
          {allowCustom ? (
            <div className="border-t border-primary/10 p-2">
              <div className="flex items-center gap-2">
                <input
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") { e.preventDefault(); addCustom(); }
                  }}
                  placeholder="Add custom color…"
                  aria-label="Add custom color"
                  className="h-9 flex-1 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  aria-label="Add custom color"
                  className="h-9 rounded-xl border border-primary/22 bg-paper px-3 text-xs font-semibold uppercase tracking-[0.12em] text-primary/80"
                >
                  Add
                </button>
              </div>
            </div>
          ) : null}

          {/* Done */}
          <div className="border-t border-primary/10 p-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="w-full rounded-xl bg-primary py-2 text-xs font-semibold uppercase tracking-[0.14em] text-paper"
            >
              Done{selected.length > 0 ? ` (${selected.length})` : ""}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Multi-select field for admin product form.
 * Use `inline` for short fixed lists (sizes); default (dropdown) for long lists (colors).
 */
export function AdminMultiSelectField({
  name,
  label,
  options,
  defaultValue = "",
  allowCustom = false,
  required = false,
  inline = false,
}: AdminMultiSelectFieldProps) {
  const initialSelected = splitCsv(defaultValue);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [extraOptions, setExtraOptions] = useState<string[]>(
    initialSelected.filter((v) => !options.includes(v))
  );
  const [customDraft, setCustomDraft] = useState("");

  const allOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...options, ...extraOptions].filter((option) => {
      const key = option.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [options, extraOptions]);

  const toggle = (value: string) =>
    setSelected((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );

  const addCustom = () => {
    const value = customDraft.trim();
    if (!value) return;
    if (!allOptions.some((o) => o.toLowerCase() === value.toLowerCase())) {
      setExtraOptions((current) => [...current, value]);
    }
    setSelected((current) => (current.includes(value) ? current : [...current, value]));
    setCustomDraft("");
  };

  if (inline) {
    return (
      <InlineChips
        name={name}
        label={label}
        allOptions={allOptions}
        selected={selected}
        toggle={toggle}
        required={required}
      />
    );
  }

  return (
    <DropdownMultiSelect
      name={name}
      label={label}
      allOptions={allOptions}
      selected={selected}
      toggle={toggle}
      required={required}
      allowCustom={allowCustom}
      customDraft={customDraft}
      setCustomDraft={setCustomDraft}
      addCustom={addCustom}
    />
  );
}
