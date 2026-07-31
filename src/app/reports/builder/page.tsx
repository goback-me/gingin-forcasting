"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ReportTable, { ColumnMeta } from "@/components/ReportTable";
import { applyReportFilters, sortReportRows, DEFAULT_REPORT_FILTERS, ReportFilters } from "@/lib/reportShared";

const DEFAULT_COLUMN_KEYS = ["name", "productCode", "category", "channel", "thisWeekExampleKg", "nextWeekEstimateKg", "growthPct", "status"];

function BuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editingViewId = searchParams.get("viewId");

  const [allColumns, setAllColumns] = useState<ColumnMeta[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingNames, setExistingNames] = useState<string[]>([]);

  const [selectedColumns, setSelectedColumns] = useState<string[]>(DEFAULT_COLUMN_KEYS);
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS);
  const [sortKey, setSortKey] = useState<string | null>("nextWeekEstimateKg");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const [saveNameDraft, setSaveNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/columns").then((r) => r.json()), fetch("/api/products").then((r) => r.json())]).then(
      ([colData, prodData]) => {
        setAllColumns(colData.columns);
        setProducts(prodData.products);
        setLoading(false);
      }
    );
    fetch("/api/views")
      .then((r) => r.json())
      .then((data) => setExistingNames(data.views.map((v: any) => v.name)));
  }, []);

  // Editing an existing view -- load its saved config once we know which one.
  useEffect(() => {
    if (!editingViewId) return;
    fetch(`/api/views/${editingViewId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) return;
        setActiveViewId(data.view.id);
        setLoadedName(data.view.name);
        setSelectedColumns(data.view.columns);
        setFilters({ ...DEFAULT_REPORT_FILTERS, ...data.view.filters });
        setSortKey(data.view.sortKey);
        setSortDir((data.view.sortDir as 1 | -1) ?? -1);
        setSaveNameDraft(data.view.name);
      });
  }, [editingViewId]);

  const columnByKey = useMemo(() => new Map(allColumns.map((c) => [c.key, c])), [allColumns]);
  const availableColumns = useMemo(
    () => allColumns.filter((c) => !selectedColumns.includes(c.key)).sort((a, b) => a.label.localeCompare(b.label)),
    [allColumns, selectedColumns]
  );

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const marketNames = useMemo(
    () => Array.from(new Set(products.filter((p) => p.marketName).map((p) => p.marketName as string))).sort(),
    [products]
  );

  const filtered = useMemo(() => applyReportFilters(products, filters), [products, filters]);
  const sorted = useMemo(() => sortReportRows(filtered, sortKey, sortDir), [filtered, sortKey, sortDir]);
  const activeFilterCount = Object.entries(filters).filter(([k, v]) => (k === "channel" || k === "status" ? v !== "all" : !!v)).length;

  function addColumn(key: string) {
    setSelectedColumns((cols) => [...cols, key]);
  }
  function removeColumn(key: string) {
    setSelectedColumns((cols) => cols.filter((c) => c !== key));
    if (sortKey === key) setSortKey(null);
  }
  function moveColumn(key: string, dir: -1 | 1) {
    setSelectedColumns((cols) => {
      const i = cols.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= cols.length) return cols;
      const next = [...cols];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function saveView() {
    const name = saveNameDraft.trim();
    if (!name) {
      setSaveMessage("Give this report a name first.");
      return;
    }
    // A collision is only real if that name belongs to some OTHER view --
    // saving under the exact name we loaded is just an update, not an overwrite warning.
    const collision = existingNames.includes(name) && name !== loadedName;
    if (collision && !confirm(`A view named "${name}" already exists. Overwrite it?`)) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, columns: selectedColumns, filters, sortKey, sortDir }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error || "Couldn't save this view.");
        return;
      }
      // Saving is "generate" -- once it's saved, hand off to the dedicated
      // viewer page rather than staying on the builder.
      router.push(`/reports/${data.view.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Link href="/reports" className="text-[12.5px] text-inkfaint hover:text-inksoft mb-2 inline-block">
        ‹ All reports
      </Link>
      <div className="font-display text-[26px] mb-1">{activeViewId ? "Edit report" : "New report"}</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Pick columns, narrow it down with filters, then save it -- you'll land on the report itself once it's saved.
      </div>

      <div className="space-y-4">
        {/* Step 1: Columns */}
        <Section step={1} title="Columns" subtitle="What shows up in the table, and in what order.">
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedColumns.length === 0 && (
              <div className="text-inkfaint text-[12.5px] py-1">Add at least one column below to get started.</div>
            )}
            {selectedColumns.map((key, i) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 bg-green-soft text-green-strong border border-green rounded-full pl-3 pr-1.5 py-1.5 text-[12.5px] font-medium"
              >
                {columnByKey.get(key)?.label ?? key}
                <button
                  className="text-green-strong/60 hover:text-green-strong disabled:opacity-25 px-0.5"
                  disabled={i === 0}
                  onClick={() => moveColumn(key, -1)}
                  title="Move left"
                >
                  ‹
                </button>
                <button
                  className="text-green-strong/60 hover:text-green-strong disabled:opacity-25 px-0.5"
                  disabled={i === selectedColumns.length - 1}
                  onClick={() => moveColumn(key, 1)}
                  title="Move right"
                >
                  ›
                </button>
                <button className="text-green-strong/60 hover:text-brick-strong px-1 font-normal" onClick={() => removeColumn(key)} title="Remove column">
                  ×
                </button>
              </span>
            ))}
          </div>

          {!showAddColumn ? (
            <button
              className="border border-borderstrong rounded-lg px-3.5 py-1.5 text-[12.5px] text-inksoft hover:bg-surface2"
              onClick={() => setShowAddColumn(true)}
            >
              + Add a column…
            </button>
          ) : (
            <div className="border-t border-border pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-[11px] text-inkfaint uppercase tracking-wide">Available columns</div>
                <button className="text-[11.5px] text-inkfaint hover:text-inksoft" onClick={() => setShowAddColumn(false)}>
                  Done
                </button>
              </div>
              {availableColumns.length === 0 ? (
                <div className="text-inkfaint text-[12.5px]">Every column is already added.</div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {availableColumns.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => addColumn(c.key)}
                      className="border border-dashed border-borderstrong rounded-full px-3 py-1.5 text-[12.5px] text-inksoft hover:border-green hover:text-green-strong hover:bg-green-soft"
                    >
                      + {c.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Step 2: Filters */}
        <Section step={2} title="Filters" subtitle="Narrow down which products show up." badge={activeFilterCount > 0 ? `${activeFilterCount} active` : undefined}>
          <div className="flex gap-2.5 flex-wrap">
            <LabeledField label="Search">
              <input
                className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-48"
                placeholder="Product name…"
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </LabeledField>
            <LabeledField label="Category">
              <select
                className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] bg-white"
                value={filters.category}
                onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </LabeledField>
            <LabeledField label="Channel">
              <select
                className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] bg-white"
                value={filters.channel}
                onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value as ReportFilters["channel"], marketName: "" }))}
              >
                <option value="all">Market + Online</option>
                <option value="Market">Market only</option>
                <option value="Online">Online only</option>
              </select>
            </LabeledField>
            {filters.channel !== "Online" && marketNames.length > 0 && (
              <LabeledField label="Market">
                <select
                  className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] bg-white"
                  value={filters.marketName}
                  onChange={(e) => setFilters((f) => ({ ...f, marketName: e.target.value }))}
                >
                  <option value="">All markets</option>
                  {marketNames.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </LabeledField>
            )}
            <LabeledField label="Status">
              <select
                className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] bg-white"
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="all">All statuses</option>
                <option value="ok">On track</option>
                <option value="declining">Declining</option>
                <option value="high_growth">High growth</option>
                <option value="low_data">Low data</option>
              </select>
            </LabeledField>
            {activeFilterCount > 0 && (
              <button
                className="text-[12px] text-brick-strong underline-offset-2 hover:underline self-end pb-2"
                onClick={() => setFilters(DEFAULT_REPORT_FILTERS)}
              >
                Clear filters
              </button>
            )}
          </div>
        </Section>

        {/* Step 3: Sort */}
        <Section step={3} title="Sort" subtitle="How rows are ordered in the table.">
          <div className="flex gap-2.5 flex-wrap items-end">
            <LabeledField label="Sort by">
              <select
                className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] bg-white w-48"
                value={sortKey ?? ""}
                onChange={(e) => setSortKey(e.target.value || null)}
              >
                <option value="">No sorting</option>
                {selectedColumns.map((key) => (
                  <option key={key} value={key}>
                    {columnByKey.get(key)?.label ?? key}
                  </option>
                ))}
              </select>
            </LabeledField>
            <button
              disabled={!sortKey}
              className="border border-borderstrong rounded-lg px-3.5 py-2 text-[12.5px] hover:bg-surface2 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => setSortDir((d) => (d === 1 ? -1 : 1))}
            >
              {sortDir === 1 ? "↑ Ascending" : "↓ Descending"}
            </button>
          </div>
        </Section>

        {/* Preview */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="text-[11px] text-inkfaint uppercase tracking-wide">Preview</div>
            <div className="text-[12px] text-inkfaint">{sorted.length} product(s)</div>
          </div>
          {loading ? (
            <div className="text-inkfaint text-sm py-10 text-center bg-surface border border-border rounded-lg">Loading…</div>
          ) : (
            <ReportTable columns={selectedColumns} columnByKey={columnByKey} rows={sorted} />
          )}
        </div>

        {/* Step 4: Save */}
        <Section step={4} title="Save this report" subtitle="Give it a name -- you'll be taken straight to it once it's saved.">
          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64"
              placeholder="e.g. Chicken -- declining"
              value={saveNameDraft}
              onChange={(e) => setSaveNameDraft(e.target.value)}
            />
            <button
              disabled={saving || selectedColumns.length === 0}
              onClick={saveView}
              className="bg-green-strong text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-green disabled:opacity-50"
            >
              {saving ? "Saving…" : activeViewId ? "Update view" : "Save report"}
            </button>
            {saveMessage && <span className="text-[12px] text-brick-strong">{saveMessage}</span>}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ step, title, subtitle, badge, children }: { step: number; title: string; subtitle: string; badge?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-5 h-5 rounded-full bg-surface2 border border-borderstrong text-inksoft text-[11px] font-medium flex items-center justify-center shrink-0">
          {step}
        </span>
        <div>
          <div className="text-[13.5px] font-medium leading-tight flex items-center gap-2">
            {title}
            {badge && <span className="text-[10.5px] text-green-strong bg-green-soft rounded-full px-2 py-0.5 font-normal">{badge}</span>}
          </div>
          <div className="text-[11.5px] text-inkfaint leading-tight">{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10.5px] text-inkfaint uppercase tracking-wide">{label}</span>
      {children}
    </div>
  );
}

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<div className="text-inkfaint text-sm py-8">Loading…</div>}>
      <BuilderInner />
    </Suspense>
  );
}