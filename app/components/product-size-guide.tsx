"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";

import { DynamicHugeIcon } from "@/app/components/dynamic-huge-icon";
import {
  MEASUREMENT_DEFINITIONS,
  type MeasurementKey,
  type SizeChartSnapshot,
} from "@/lib/product-merchandising";

type ProductSizeGuideProps = {
  chart: SizeChartSnapshot;
};

const UNIT_OPTIONS: Array<"in" | "cm"> = ["in", "cm"];

function convertMeasurement(value: number, from: "in" | "cm", to: "in" | "cm"): number {
  if (from === to) return value;
  const converted = from === "in" ? value * 2.54 : value / 2.54;
  return Math.round(converted * 10) / 10;
}

function measurementLabel(key: MeasurementKey): string {
  return MEASUREMENT_DEFINITIONS.find((definition) => definition.key === key)?.label ?? key;
}

export function ProductSizeGuide({ chart }: ProductSizeGuideProps): ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chart" | "measure">("chart");
  const [unit, setUnit] = useState<"in" | "cm">(chart.unit);
  const visibleColumns = useMemo(
    () => chart.columns.filter((column) =>
      chart.rows.some((row) => typeof row.measurements[column] === "number")
    ),
    [chart.columns, chart.rows]
  );
  const visibleRows = useMemo(
    () => chart.rows.filter((row) =>
      visibleColumns.some((column) => typeof row.measurements[column] === "number")
    ),
    [chart.rows, visibleColumns]
  );
  const hasBrandSizes = visibleRows.some((row) => row.brandSize.trim().length > 0);
  const guideItems = useMemo(
    () => visibleColumns.flatMap((column) => {
      const definition = MEASUREMENT_DEFINITIONS.find((item) => item.key === column);
      return definition ? [definition] : [];
    }),
    [visibleColumns]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (visibleColumns.length === 0 || visibleRows.length === 0) return <></>;

  return (
    <>
      <button
        type="button"
        aria-label="Open size guide"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
        className="text-[0.62rem] uppercase tracking-widest text-primary/55 underline decoration-primary/30 underline-offset-4 transition hover:text-primary sm:text-[0.65rem]"
      >
        Size Guide
      </button>

      {typeof document !== "undefined" ? createPortal(<AnimatePresence>
        {isOpen ? (
          <motion.div
            className="fixed inset-0 z-[300] flex items-end justify-center bg-primary/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsOpen(false);
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-size-guide-title"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 32, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.985 }}
              transition={{ duration: prefersReducedMotion ? 0.08 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="max-h-[88vh] w-full overflow-hidden rounded-t-[1.75rem] border border-primary/12 bg-paper shadow-[0_32px_90px_rgba(55,8,8,0.3)] sm:max-w-5xl sm:rounded-[1.75rem]"
            >
              <header className="flex items-center justify-between border-b border-primary/10 px-4 py-4 sm:px-6">
                <div>
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-primary/48">Find your fit</p>
                  <h2 id="product-size-guide-title" className="mt-1 font-display text-xl sm:text-2xl">{chart.name}</h2>
                </div>
                <button type="button" onClick={() => setIsOpen(false)} aria-label="Close size guide" className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 text-primary transition hover:bg-primary hover:text-paper">
                  <DynamicHugeIcon name="Cancel01Icon" className="h-4 w-4" aria-hidden={true} />
                </button>
              </header>

              <div className="flex border-b border-primary/10" role="tablist" aria-label="Size guide sections">
                <button type="button" role="tab" aria-selected={activeTab === "chart"} onClick={() => setActiveTab("chart")} className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${activeTab === "chart" ? "text-primary" : "text-primary/48"}`}>
                  Size Chart
                  {activeTab === "chart" ? <span className="absolute inset-x-8 bottom-0 h-0.5 bg-primary" /> : null}
                </button>
                <button type="button" role="tab" aria-selected={activeTab === "measure"} onClick={() => setActiveTab("measure")} className={`relative flex-1 px-4 py-3 text-sm font-semibold transition ${activeTab === "measure" ? "text-primary" : "text-primary/48"}`}>
                  How to Measure
                  {activeTab === "measure" ? <span className="absolute inset-x-8 bottom-0 h-0.5 bg-primary" /> : null}
                </button>
              </div>

              <div className="max-h-[64vh] overflow-auto p-4 sm:p-6">
                {activeTab === "chart" ? (
                  <>
                    <div className="mb-4 flex justify-end">
                      <div className="flex rounded-full border border-primary/15 bg-secondary p-1" role="group" aria-label="Measurement unit">
                        {UNIT_OPTIONS.map((option) => (
                          <button key={option} type="button" aria-label={`Show measurements in ${option === "in" ? "inches" : "centimetres"}`} aria-pressed={unit === option} onClick={() => setUnit(option)} className={`rounded-full px-3 py-1.5 text-[0.65rem] font-bold uppercase transition ${unit === option ? "bg-primary text-paper" : "text-primary/55"}`}>
                            {option}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-secondary">
                      <table className="w-full min-w-max border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-primary/12 bg-primary/[0.04] text-left text-[0.62rem] uppercase tracking-[0.12em] text-primary/58">
                            <th className="px-4 py-3">Size</th>
                            {hasBrandSizes ? <th className="px-4 py-3">Brand Size</th> : null}
                            {visibleColumns.map((column) => <th key={column} className="px-4 py-3">{measurementLabel(column)} ({unit})</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRows.map((row) => (
                            <tr key={`${row.size}-${row.brandSize}`} className="border-b border-primary/8 last:border-b-0">
                              <th className="px-4 py-3 text-left font-bold">{row.size}</th>
                              {hasBrandSizes ? <td className="px-4 py-3">{row.brandSize || "—"}</td> : null}
                              {visibleColumns.map((column) => {
                                const value = row.measurements[column];
                                return <td key={column} className="px-4 py-3 tabular-nums">{typeof value === "number" ? convertMeasurement(value, chart.unit, unit).toFixed(1) : "—"}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-3 text-[0.65rem] text-primary/48">Garment measurements. Empty values are intentionally unavailable.</p>
                  </>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {guideItems.map((item, index) => (
                      <article key={item.key} className="flex gap-3 rounded-2xl border border-primary/10 bg-secondary p-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-paper">{index + 1}</span>
                        <div><h3 className="text-sm font-bold">{item.label}</h3><p className="mt-1 text-xs leading-relaxed text-primary/62">{item.guide}</p></div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>, document.body) : null}
    </>
  );
}
