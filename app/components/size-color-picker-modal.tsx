"use client";

import { useState } from "react";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import type { ProductRecord } from "@/lib/appwrite/products";
import { getAvailableStockForSize } from "@/lib/product-merchandising";

type Props = {
  product: ProductRecord;
  actionLabel?: string;
  onConfirm: (selection: { size: string; color: string }) => void;
  onClose: () => void;
};

export function SizeColorPickerModal({ product, actionLabel = "Confirm", onConfirm, onClose }: Props) {
  const hasColors = product.colorOptions.length > 0;
  const hasSizes = product.sizeOptions.length > 0;

  const [selectedColor, setSelectedColor] = useState(hasColors ? product.colorOptions[0] : "");
  const [selectedSize, setSelectedSize] = useState("");

  const canConfirm = !hasSizes || selectedSize !== "";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-primary/25 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-primary/15 bg-secondary p-6 shadow-xl">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-primary/50 transition hover:bg-primary/8 hover:text-primary"
        >
          <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" iconStrokeWidth={2} aria-hidden />
        </button>

        <h2 className="text-base font-semibold text-primary">Select Options</h2>
        <p className="mt-0.5 line-clamp-1 text-xs text-primary/60">{product.name}</p>

        {hasColors && (
          <div className="mt-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary/60">Color</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {product.colorOptions.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Select color ${color}`}
                  aria-pressed={selectedColor === color}
                  onClick={() => setSelectedColor(color)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedColor === color
                      ? "border-primary bg-primary text-secondary"
                      : "border-primary/20 text-primary hover:border-primary/45"
                  }`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasSizes && (
          <div className="mt-5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary/60">
              Size <span className="ml-0.5 text-red-500">*</span>
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {product.sizeOptions.map((size) => {
                const unavailable = product.sizeInventory.length > 0
                  ? getAvailableStockForSize(product.sizeInventory, size) <= 0
                  : product.stockQty <= 0;
                return (
                  <button
                    key={size}
                    type="button"
                    disabled={unavailable}
                    aria-label={unavailable ? `Size ${size} unavailable` : `Select size ${size}`}
                    aria-pressed={selectedSize === size}
                    onClick={() => setSelectedSize(size)}
                    className={`h-9 min-w-[2.5rem] rounded-lg border px-3 text-xs font-semibold transition ${
                      unavailable
                        ? "cursor-not-allowed border-primary/10 text-primary/30 line-through"
                        : selectedSize === size
                          ? "border-primary bg-primary text-secondary"
                          : "border-primary/20 text-primary hover:border-primary/45"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
            {!selectedSize && (
              <p className="mt-1.5 text-[0.65rem] text-primary/50">Please select a size to continue.</p>
            )}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 flex-1 rounded-xl border border-primary/20 text-xs font-semibold uppercase tracking-[0.14em] text-primary transition hover:border-primary/45 hover:bg-primary/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ size: selectedSize, color: selectedColor })}
            className="h-10 flex-1 rounded-xl bg-primary text-xs font-semibold uppercase tracking-[0.14em] text-secondary transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
