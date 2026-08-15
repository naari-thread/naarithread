"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useDeferredValue,
  useId,
  useMemo,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import type { ProductSearchEntry } from "@/lib/firebase/product-search-index";
import { normalizeProductSearchText, rankProductSearchEntries } from "@/lib/product-search";
import { getCategoryLabelBySlug, getSubCategoryLabelBySlug } from "@/lib/product-taxonomy";

const MINIMUM_QUERY_LENGTH = 2;
const MAXIMUM_SUGGESTIONS = 6;
type ProductSearchComboboxProps = {
  products: ProductSearchEntry[];
  value: string;
  onValueChange: (value: string) => void;
  onProductSelect: (product: ProductSearchEntry) => void;
};

export function ProductSearchCombobox({
  products,
  value,
  onValueChange,
  onProductSelect,
}: ProductSearchComboboxProps): ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const deferredValue = useDeferredValue(value);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const normalizedQuery = normalizeProductSearchText(deferredValue);
  const suggestions = useMemo(
    () => normalizedQuery.length >= MINIMUM_QUERY_LENGTH
      ? rankProductSearchEntries(products, normalizedQuery, MAXIMUM_SUGGESTIONS)
      : [],
    [normalizedQuery, products]
  );
  const shouldShowSuggestions = isOpen && normalizedQuery.length >= MINIMUM_QUERY_LENGTH;
  const activeSuggestion = suggestions[activeIndex];

  const selectSuggestion = (product: ProductSearchEntry): void => {
    onValueChange(product.name);
    setIsOpen(false);
    setActiveIndex(-1);
    onProductSelect(product);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onValueChange(event.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>): void => {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === "Enter" && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
    }
  };

  return (
    <div className="relative w-full sm:w-auto sm:flex-1" onBlur={handleBlur}>
      <div
        className={`group flex h-11 w-full items-center gap-2.5 rounded-xl border bg-secondary px-3.5 transition-colors sm:w-auto sm:flex-1 ${
          shouldShowSuggestions
            ? "border-primary/30 shadow-[0_10px_28px_rgba(120,0,0,0.08)]"
            : "border-primary/12 focus-within:border-primary/28"
        }`}
      >
        <label htmlFor="products-search" className="sr-only">
          Search for any product
        </label>
        <DynamicHugeIcon
          name="Search01Icon"
          className="h-4.5 w-4.5 shrink-0 text-primary/68"
          iconStrokeWidth={1.9}
          aria-hidden={true}
        />
        <input
          id="products-search"
          type="search"
          role="combobox"
          aria-label="Search for any product"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={shouldShowSuggestions}
          aria-activedescendant={activeSuggestion ? `${listboxId}-option-${activeIndex}` : undefined}
          autoComplete="off"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name, category, or subcategory"
          className="w-full bg-transparent text-[0.98rem] text-primary placeholder:text-primary/62 outline-none"
        />
        {value ? (
          <button
            type="button"
            aria-label="Clear product search"
            onClick={() => {
              onValueChange("");
              setIsOpen(false);
              setActiveIndex(-1);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary/55 transition hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
          >
            <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" aria-hidden={true} />
          </button>
        ) : null}
      </div>

      <AnimatePresence>
        {shouldShowSuggestions ? (
          <motion.div
            id={listboxId}
            role="listbox"
            aria-label="Product search suggestions"
            initial={prefersReducedMotion ? false : { opacity: 0, y: -5, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: prefersReducedMotion ? 0.08 : 0.16, ease: "easeOut" }}
            className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-[90] overflow-hidden rounded-2xl border border-primary/14 bg-secondary shadow-[0_24px_65px_rgba(68,0,0,0.18)]"
          >
            <div className="flex items-center justify-between border-b border-primary/10 px-3.5 py-2.5">
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary/55">
                Quick matches
              </span>
              {suggestions.length > 0 ? (
                <span className="text-[0.68rem] font-semibold text-primary/48">
                  {suggestions.length} result{suggestions.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>

            {suggestions.length > 0 ? (
              <div className="max-h-[21rem] overflow-y-auto p-1.5">
                {suggestions.map((product, index) => {
                  const isActive = index === activeIndex;
                  const categoryLabel = getCategoryLabelBySlug(product.category);
                  const subCategoryLabel = getSubCategoryLabelBySlug(product.subCategory);

                  return (
                    <button
                      key={product.id}
                      id={`${listboxId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-label={`Open ${product.name}`}
                      aria-selected={isActive}
                      onPointerDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => selectSuggestion(product)}
                      className={`group flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                        isActive ? "bg-primary text-secondary" : "text-primary hover:bg-primary/7"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold leading-tight">
                          {product.name}
                        </span>
                        <span
                          className={`mt-1 block truncate text-[0.68rem] font-medium ${
                            isActive ? "text-secondary/72" : "text-primary/52"
                          }`}
                        >
                          {categoryLabel} / {subCategoryLabel}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center">
                        <DynamicHugeIcon
                          name="ArrowRight01Icon"
                          className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${
                            isActive ? "text-secondary" : "text-primary/48"
                          }`}
                          aria-hidden={true}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-4 text-primary/62">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/7">
                  <DynamicHugeIcon name="Search01Icon" className="h-4 w-4" aria-hidden={true} />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-primary">No quick matches</span>
                  <span className="mt-0.5 block text-xs">Try a category, style, or product name.</span>
                </span>
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
