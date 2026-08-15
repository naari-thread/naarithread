"use client";

import { useMemo, useState, type ReactElement } from "react";

import { AdminImageUploadField } from "@/app/components/admin-image-upload-field";
import {
  MEASUREMENT_DEFINITIONS,
  type MeasurementKey,
  type ProductColorMedia,
  type SizeChartSnapshot,
  type SizeInventoryItem,
  sizeChartSnapshotSchema,
} from "@/lib/product-merchandising";

type AdminProductMerchandisingFieldsProps = {
  availableSizes: string[];
  availableColors: string[];
  charts: SizeChartSnapshot[];
  initialSizes: string[];
  initialInventory: SizeInventoryItem[];
  initialColors: string[];
  initialColorMedia: ProductColorMedia[];
  initialSizeChartId: string;
  initialSizeChart: SizeChartSnapshot | null;
};

const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
type ChartMode = "none" | "existing" | "custom";
const CHART_MODES: ChartMode[] = ["none", "existing", "custom"];

function uniqueValues(values: string[]): string[] {
  const byValue = new Map<string, string>();
  for (const value of values) {
    const trimmed = value.trim();
    if (trimmed) byValue.set(trimmed.toLowerCase(), trimmed);
  }
  return [...byValue.values()];
}

function createDraftChart(source: SizeChartSnapshot): SizeChartSnapshot {
  const columns = source.columns.slice(0, 3);
  return {
    ...source,
    id: "draft",
    name: source.isPreset ? `${source.name} Custom` : source.name,
    isPreset: false,
    columns,
    rows: source.rows.map((row) => ({
      ...row,
      measurements: Object.fromEntries(
        columns.map((column) => [column, row.measurements[column] ?? null])
      ),
    })),
  };
}

function cloneChart(source: SizeChartSnapshot): SizeChartSnapshot {
  return {
    ...source,
    columns: [...source.columns],
    rows: source.rows.map((row) => ({
      ...row,
      measurements: { ...row.measurements },
    })),
  };
}

function getApiError(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object"
    && payload !== null
    && "error" in payload
    && typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

function measurementLabel(key: MeasurementKey): string {
  return MEASUREMENT_DEFINITIONS.find((definition) => definition.key === key)?.label ?? key;
}

function AdminSizeChartPreview({ chart }: { chart: SizeChartSnapshot }): ReactElement {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-primary/14 bg-paper">
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 px-3 py-2.5">
        <div>
          <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em] text-primary/50">Preview</p>
          <p className="mt-0.5 text-sm font-semibold text-primary">{chart.name}</p>
        </div>
        <span className="rounded-full border border-primary/14 bg-secondary px-2.5 py-1 text-[0.58rem] font-bold uppercase tracking-[0.14em] text-primary/65">
          {chart.unit === "in" ? "Inches" : "Centimetres"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max border-collapse text-xs">
          <thead>
            <tr className="border-b border-primary/10 bg-primary/[0.035] text-left">
              <th scope="col" className="px-3 py-2 font-bold">Size</th>
              <th scope="col" className="px-3 py-2 font-bold">Brand size</th>
              {chart.columns.map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-bold">
                  {measurementLabel(column)} ({chart.unit})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chart.rows.map((row, rowIndex) => (
              <tr key={`${row.size}-${rowIndex}`} className="border-b border-primary/8 last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-bold text-primary">{row.size || "—"}</th>
                <td className="px-3 py-2 text-primary/72">{row.brandSize || "—"}</td>
                {chart.columns.map((column) => (
                  <td key={column} className="px-3 py-2 text-primary/72">
                    {row.measurements[column] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminProductMerchandisingFields({
  availableSizes,
  availableColors,
  charts,
  initialSizes,
  initialInventory,
  initialColors,
  initialColorMedia,
  initialSizeChartId,
  initialSizeChart,
}: AdminProductMerchandisingFieldsProps): ReactElement {
  const sizeChoices = useMemo(
    () => uniqueValues([...DEFAULT_SIZES, ...availableSizes, ...initialSizes]),
    [availableSizes, initialSizes]
  );
  const colorChoices = useMemo(
    () => uniqueValues([...availableColors, ...initialColors]),
    [availableColors, initialColors]
  );
  const [inventory, setInventory] = useState<SizeInventoryItem[]>(() =>
    initialInventory.length > 0
      ? initialInventory
      : initialSizes.map((size) => ({ size, stockQty: 0 }))
  );
  const [customSize, setCustomSize] = useState("");
  const [colors, setColors] = useState<string[]>(initialColors);
  const [customColor, setCustomColor] = useState("");
  const [colorMedia, setColorMedia] = useState<ProductColorMedia[]>(initialColorMedia);
  const [chartLibrary, setChartLibrary] = useState<SizeChartSnapshot[]>(() =>
    initialSizeChart && !charts.some((chart) => chart.id === initialSizeChart.id)
      ? [...charts, initialSizeChart]
      : charts
  );
  const [chartMode, setChartMode] = useState<ChartMode>(
    initialSizeChart ? "existing" : "none"
  );
  const [selectedChartId, setSelectedChartId] = useState(initialSizeChartId);
  const defaultDraftSource = charts[0] ?? initialSizeChart ?? null;
  const [draftChart, setDraftChart] = useState<SizeChartSnapshot | null>(
    defaultDraftSource ? createDraftChart(defaultDraftSource) : null
  );
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [chartActionError, setChartActionError] = useState("");
  const [isMutatingChart, setIsMutatingChart] = useState(false);

  const selectedChart = chartLibrary.find((chart) => chart.id === selectedChartId);
  const attachedChart = chartMode === "existing" ? selectedChart : chartMode === "custom" ? draftChart : null;
  const totalStock = inventory.reduce((total, item) => total + item.stockQty, 0);

  const toggleSize = (size: string): void => {
    setInventory((current) =>
      current.some((item) => item.size === size)
        ? current.filter((item) => item.size !== size)
        : [...current, { size, stockQty: 0 }]
    );
  };

  const addCustomSize = (): void => {
    const size = customSize.trim().toUpperCase();
    if (!size) return;
    setInventory((current) =>
      current.some((item) => item.size.toLowerCase() === size.toLowerCase())
        ? current
        : [...current, { size, stockQty: 0 }]
    );
    setCustomSize("");
  };

  const toggleColor = (color: string): void => {
    if (colors.includes(color)) {
      const mapping = colorMedia.find((entry) => entry.color === color);
      if (mapping && mapping.imageUrls.length > 0 && !window.confirm(`Remove ${color} and its image mapping?`)) {
        return;
      }
      setColors((current) => current.filter((item) => item !== color));
      setColorMedia((current) => current.filter((entry) => entry.color !== color));
      return;
    }
    setColors((current) => [...current, color]);
  };

  const addCustomColor = (): void => {
    const color = customColor.trim();
    if (!color) return;
    setColors((current) =>
      current.some((item) => item.toLowerCase() === color.toLowerCase()) ? current : [...current, color]
    );
    setCustomColor("");
  };

  const setImagesForColor = (color: string, imageUrls: string[]): void => {
    setColorMedia((current) => {
      const rest = current.filter((entry) => entry.color !== color);
      return imageUrls.length > 0
        ? [...rest, { color, imageUrls, primaryImageUrl: imageUrls[0] }]
        : rest;
    });
  };

  const toggleMeasurement = (key: MeasurementKey): void => {
    setDraftChart((current) => {
      if (!current) return current;
      const hasColumn = current.columns.includes(key);
      const columns = hasColumn
        ? current.columns.filter((column) => column !== key)
        : [...current.columns, key];
      if (columns.length === 0) return current;
      return { ...current, columns };
    });
  };

  const setMeasurement = (
    rowIndex: number,
    key: MeasurementKey,
    rawValue: string
  ): void => {
    setDraftChart((current) => {
      if (!current) return current;
      const numericValue = rawValue.trim() ? Number(rawValue) : null;
      if (numericValue !== null && (!Number.isFinite(numericValue) || numericValue < 0)) return current;
      return {
        ...current,
        rows: current.rows.map((row, index) =>
          index === rowIndex
            ? { ...row, measurements: { ...row.measurements, [key]: numericValue } }
            : row
        ),
      };
    });
  };

  const addChartRow = (): void => {
    setDraftChart((current) => current
      ? { ...current, rows: [...current.rows, { size: "", brandSize: "", measurements: {} }] }
      : current
    );
  };

  const selectChartMode = (mode: ChartMode): void => {
    setChartMode(mode);
    setChartActionError("");
    if (mode === "custom") {
      setEditingChartId(null);
      if (defaultDraftSource) setDraftChart(createDraftChart(defaultDraftSource));
    }
  };

  const editSelectedChart = (): void => {
    if (!selectedChart) return;
    setDraftChart(cloneChart(selectedChart));
    setEditingChartId(selectedChart.id);
    setChartActionError("");
    setChartMode("custom");
  };

  const saveEditedChart = async (): Promise<void> => {
    if (!editingChartId || !draftChart || isMutatingChart) return;
    const parsedDraft = sizeChartSnapshotSchema.safeParse({
      ...draftChart,
      id: editingChartId,
    });
    if (!parsedDraft.success) {
      setChartActionError("Add a chart name and size label, then check all measurement values.");
      return;
    }

    setIsMutatingChart(true);
    setChartActionError("");
    try {
      const response = await fetch(`/api/admin/size-charts/${encodeURIComponent(editingChartId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedDraft.data),
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setChartActionError(getApiError(payload, "Could not update this preset."));
        return;
      }
      const parsedResponse = typeof payload === "object" && payload !== null && "chart" in payload
        ? sizeChartSnapshotSchema.safeParse(payload.chart)
        : null;
      if (!parsedResponse?.success) {
        setChartActionError("The preset was saved, but its response could not be read.");
        return;
      }
      setChartLibrary((current) => [
        ...current.filter((chart) => chart.id !== editingChartId),
        parsedResponse.data,
      ]);
      setSelectedChartId(editingChartId);
      setEditingChartId(null);
      setChartMode("existing");
    } catch {
      setChartActionError("Could not update this preset. Check your connection and retry.");
    } finally {
      setIsMutatingChart(false);
    }
  };

  const deleteSelectedChart = async (): Promise<void> => {
    if (!selectedChart || isMutatingChart) return;
    if (!window.confirm(`Delete the preset “${selectedChart.name}”? Existing products will keep their saved chart.`)) {
      return;
    }

    setIsMutatingChart(true);
    setChartActionError("");
    try {
      const response = await fetch(`/api/admin/size-charts/${encodeURIComponent(selectedChart.id)}`, {
        method: "DELETE",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setChartActionError(getApiError(payload, "Could not delete this preset."));
        return;
      }
      const remainingCharts = chartLibrary.filter((chart) => chart.id !== selectedChart.id);
      setChartLibrary(remainingCharts);
      setSelectedChartId(remainingCharts[0]?.id ?? "");
      setChartMode(remainingCharts.length > 0 ? "existing" : "none");
    } catch {
      setChartActionError("Could not delete this preset. Check your connection and retry.");
    } finally {
      setIsMutatingChart(false);
    }
  };

  return (
    <>
      <input type="hidden" name="sizeOptions" value={inventory.map((item) => item.size).join(", ")} />
      <input type="hidden" name="sizeInventory" value={JSON.stringify(inventory)} />
      <input type="hidden" name="stockQty" value={String(totalStock)} />
      <input type="hidden" name="colorOptions" value={colors.join(", ")} />
      <input type="hidden" name="colorMedia" value={JSON.stringify(colorMedia)} />
      <input type="hidden" name="sizeChartId" value={chartMode === "existing" ? selectedChartId : ""} />
      <input type="hidden" name="sizeChart" value={attachedChart ? JSON.stringify(attachedChart) : ""} />
      <input type="hidden" name="createSizeChart" value={chartMode === "custom" ? "true" : "false"} />

      <section className="sm:col-span-2 rounded-2xl border border-primary/14 bg-primary/[0.025] p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary/55">Inventory by size</p>
            <h3 className="mt-1 font-display text-xl text-primary">Choose sizes, then set real stock</h3>
          </div>
          <span className="rounded-full bg-primary px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-paper">
            {totalStock} total
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {sizeChoices.map((size) => {
            const selected = inventory.some((item) => item.size === size);
            return (
              <button
                key={size}
                type="button"
                aria-label={`${selected ? "Remove" : "Add"} size ${size}`}
                aria-pressed={selected}
                onClick={() => toggleSize(size)}
                className={`min-h-9 rounded-full border px-3 text-xs font-bold transition ${selected ? "border-primary bg-primary text-paper" : "border-primary/20 bg-paper text-primary hover:border-primary/45"}`}
              >
                {size}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={customSize}
            onChange={(event) => setCustomSize(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomSize();
              }
            }}
            aria-label="Custom size label"
            placeholder="Custom size"
            className="h-10 min-w-0 flex-1 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary"
          />
          <button type="button" onClick={addCustomSize} aria-label="Add custom size" className="rounded-xl border border-primary/25 px-4 text-xs font-bold uppercase tracking-[0.12em]">Add</button>
        </div>

        {inventory.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {inventory.map((item) => (
              <label key={item.size} className="flex items-center justify-between gap-3 rounded-xl border border-primary/12 bg-paper p-3">
                <span className="text-sm font-bold">{item.size}</span>
                <span className="flex items-center gap-2 text-xs text-primary/55">
                  Stock
                  <input
                    type="number"
                    min="0"
                    max="999999"
                    value={item.stockQty}
                    onChange={(event) => {
                      const stockQty = Math.max(0, Math.trunc(Number(event.target.value) || 0));
                      setInventory((current) => current.map((candidate) =>
                        candidate.size === item.size ? { ...candidate, stockQty } : candidate
                      ));
                    }}
                    aria-label={`Stock for size ${item.size}`}
                    className="h-9 w-20 rounded-lg border border-primary/18 bg-secondary px-2 text-right text-sm font-semibold outline-none focus:border-primary"
                  />
                </span>
              </label>
            ))}
          </div>
        ) : <p className="mt-4 text-xs text-primary/55">Select at least one size to create inventory.</p>}
      </section>

      <section className="sm:col-span-2 rounded-2xl border border-primary/14 bg-secondary p-4 sm:p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary/55">Colors & image stories</p>
        <h3 className="mt-1 font-display text-xl">Map a gallery to every color</h3>
        <div className="mt-4 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {colorChoices.map((color) => {
            const selected = colors.includes(color);
            return (
              <button key={color} type="button" aria-label={`${selected ? "Remove" : "Add"} color ${color}`} aria-pressed={selected} onClick={() => toggleColor(color)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selected ? "border-primary bg-primary text-paper" : "border-primary/20 bg-paper text-primary hover:border-primary/45"}`}>
                {color}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <input value={customColor} onChange={(event) => setCustomColor(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomColor(); } }} aria-label="Custom color name" placeholder="Custom color" className="h-10 min-w-0 flex-1 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary" />
          <button type="button" onClick={addCustomColor} aria-label="Add custom color" className="rounded-xl border border-primary/25 px-4 text-xs font-bold uppercase tracking-[0.12em]">Add</button>
        </div>

        {colors.length > 0 ? (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {colors.map((color) => {
              const mapping = colorMedia.find((entry) => entry.color === color);
              return (
                <article key={color} className="rounded-2xl border border-primary/12 bg-paper p-3.5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="font-display text-lg">{color}</h4>
                    <span className="text-[0.58rem] font-bold uppercase tracking-[0.14em] text-primary/45">First image is primary</span>
                  </div>
                  <AdminImageUploadField
                    name={`colorMedia:${color}`}
                    label={`${color} product images`}
                    multiple
                    allowPrimarySelection
                    defaultValue={mapping?.imageUrls.join(", ") ?? ""}
                    onValueChange={(urls) => setImagesForColor(color, urls)}
                  />
                </article>
              );
            })}
          </div>
        ) : <p className="mt-4 text-xs text-primary/55">Add colors to create color-specific galleries.</p>}
      </section>

      <section className="sm:col-span-2 rounded-2xl border border-primary/14 bg-primary/[0.025] p-4 sm:p-5">
        <p className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-primary/55">Size guide</p>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Size chart attachment mode">
          {CHART_MODES.map((mode) => (
            <button key={mode} type="button" role="radio" aria-checked={chartMode === mode} onClick={() => selectChartMode(mode)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold capitalize transition ${chartMode === mode ? "border-primary bg-primary text-paper" : "border-primary/18 bg-paper text-primary"}`}>
              {mode === "none" ? "No chart" : mode === "existing" ? "Attach existing" : "Create new"}
            </button>
          ))}
        </div>

        {chartMode === "existing" ? (
          <div className="mt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary/55">Chart</span>
              <select value={selectedChartId} onChange={(event) => setSelectedChartId(event.target.value)} aria-label="Attached size chart" className="h-11 rounded-xl border border-primary/18 bg-paper px-3 text-sm outline-none focus:border-primary">
                <option value="">Choose a chart</option>
                {chartLibrary.map((chart) => <option key={chart.id} value={chart.id}>{chart.name}</option>)}
              </select>
            </label>
            {selectedChart ? (
              <>
                <p className="mt-2 text-xs text-primary/55">
                  {selectedChart.rows.length} sizes · {selectedChart.columns.length} measurements · {selectedChart.unit}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={editSelectedChart} disabled={isMutatingChart} aria-label={`Edit ${selectedChart.name} preset`} className="rounded-lg border border-primary/20 bg-paper px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] transition hover:border-primary/45 disabled:cursor-not-allowed disabled:opacity-50">Edit preset</button>
                  <button type="button" onClick={() => void deleteSelectedChart()} disabled={isMutatingChart} aria-label={`Delete ${selectedChart.name} preset`} className="rounded-lg border border-red-700/20 bg-paper px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-red-700 transition hover:border-red-700/45 disabled:cursor-not-allowed disabled:opacity-50">{isMutatingChart ? "Working…" : "Delete"}</button>
                </div>
                <AdminSizeChartPreview chart={selectedChart} />
              </>
            ) : null}
          </div>
        ) : null}

        {chartMode === "custom" && draftChart ? (
          <div className="mt-4 space-y-4">
            {editingChartId ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/12 bg-paper px-3 py-2.5">
                <p className="text-xs font-semibold text-primary/65">Editing an existing preset</p>
                <button type="button" onClick={() => void saveEditedChart()} disabled={isMutatingChart} aria-label="Save size chart preset changes" className="rounded-lg bg-primary px-3 py-2 text-[0.65rem] font-bold uppercase tracking-[0.1em] text-paper disabled:cursor-not-allowed disabled:opacity-50">{isMutatingChart ? "Saving…" : "Save preset changes"}</button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="sm:col-span-2 flex flex-col gap-1.5"><span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary/55">Chart name</span><input value={draftChart.name} onChange={(event) => setDraftChart((current) => current ? { ...current, name: event.target.value } : current)} aria-label="Custom size chart name" className="h-10 rounded-xl border border-primary/18 bg-paper px-3 text-sm" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-[0.62rem] font-bold uppercase tracking-[0.16em] text-primary/55">Unit</span><select value={draftChart.unit} onChange={(event) => setDraftChart((current) => current ? { ...current, unit: event.target.value === "cm" ? "cm" : "in" } : current)} aria-label="Size chart unit" className="h-10 rounded-xl border border-primary/18 bg-paper px-3 text-sm"><option value="in">Inches</option><option value="cm">Centimetres</option></select></label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MEASUREMENT_DEFINITIONS.map((definition) => {
                const selected = draftChart.columns.includes(definition.key);
                return <button key={definition.key} type="button" aria-label={`${selected ? "Remove" : "Add"} ${definition.label} measurement`} aria-pressed={selected} onClick={() => toggleMeasurement(definition.key)} className={`rounded-full border px-2.5 py-1.5 text-[0.65rem] font-semibold ${selected ? "border-primary bg-primary text-paper" : "border-primary/18 bg-paper text-primary"}`}>{definition.label}</button>;
              })}
            </div>
            <div className="overflow-x-auto rounded-xl border border-primary/12 bg-paper">
              <table className="min-w-max border-collapse text-xs">
                <thead><tr className="border-b border-primary/12 bg-primary/[0.04]"><th className="px-3 py-2 text-left">Size</th><th className="px-3 py-2 text-left">Brand size</th>{draftChart.columns.map((column) => <th key={column} className="px-3 py-2 text-left">{MEASUREMENT_DEFINITIONS.find((item) => item.key === column)?.label}</th>)}<th aria-label="Row actions" /></tr></thead>
                <tbody>
                  {draftChart.rows.map((row, rowIndex) => (
                    <tr key={`${rowIndex}-${row.size}`} className="border-b border-primary/8 last:border-b-0">
                      <td className="p-1.5"><input value={row.size} onChange={(event) => setDraftChart((current) => current ? { ...current, rows: current.rows.map((candidate, index) => index === rowIndex ? { ...candidate, size: event.target.value } : candidate) } : current)} aria-label={`Size label row ${rowIndex + 1}`} className="h-9 w-20 rounded-lg border border-primary/16 px-2" /></td>
                      <td className="p-1.5"><input value={row.brandSize} onChange={(event) => setDraftChart((current) => current ? { ...current, rows: current.rows.map((candidate, index) => index === rowIndex ? { ...candidate, brandSize: event.target.value } : candidate) } : current)} aria-label={`Brand size row ${rowIndex + 1}`} className="h-9 w-24 rounded-lg border border-primary/16 px-2" /></td>
                      {draftChart.columns.map((column) => <td key={column} className="p-1.5"><input type="number" min="0" step="0.1" value={row.measurements[column] ?? ""} onChange={(event) => setMeasurement(rowIndex, column, event.target.value)} aria-label={`${column} for ${row.size || `row ${rowIndex + 1}`}`} className="h-9 w-24 rounded-lg border border-primary/16 px-2" /></td>)}
                      <td className="p-1.5"><button type="button" aria-label={`Remove size chart row ${rowIndex + 1}`} onClick={() => setDraftChart((current) => current && current.rows.length > 1 ? { ...current, rows: current.rows.filter((_, index) => index !== rowIndex) } : current)} className="h-9 rounded-lg px-2 text-red-700">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={addChartRow} aria-label="Add size chart row" className="rounded-xl border border-primary/22 bg-paper px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">Add size row</button>
          </div>
        ) : null}
        {chartActionError ? <p role="alert" className="mt-3 text-xs font-semibold text-red-700">{chartActionError}</p> : null}
      </section>
    </>
  );
}
