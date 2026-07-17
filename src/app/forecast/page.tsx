"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

type Product = {
  name: string;
  sku: string | null;
  category: string;
  twoMonthsAgoQty: number;
  twoMonthsAgoKg: number | null;
  twoMonthsAgoLabel: string;
  lastMonthQty: number;
  lastMonthKg: number | null;
  lastMonthLabel: string;
  thisMonthQty: number;
  thisMonthKg: number | null;
  thisMonthLabel: string;
  growthPct: number;
  thisWeekExampleQty: number;
  thisWeekExampleKg: number | null;
  nextWeekEstimateQty: number;
  nextWeekEstimateKg: number | null;
  recQtyNextMonth: number;
  recKgNextMonth: number | null;
  status: string;
};

type Column = { key: string; label: string; type: string; visible: boolean; sortOrder: number };
type MonthInfo = { month: string; label: string; isPartial: boolean };

const COLUMN_WIDTH: Record<string, string> = {
  name: "18%",
  category: "11%",
  twoMonthsAgoKg: "9%",
  lastMonthKg: "9%",
  thisMonthKg: "10%",
  growthPct: "9%",
  thisWeekExampleKg: "10%",
  nextWeekEstimateKg: "10%",
  recKgNextMonth: "12%",
  status: "9%",
};

const KG_TO_QTY: Record<string, string> = {
  twoMonthsAgoKg: "twoMonthsAgoQty",
  lastMonthKg: "lastMonthQty",
  thisMonthKg: "thisMonthQty",
  thisWeekExampleKg: "thisWeekExampleQty",
  nextWeekEstimateKg: "nextWeekEstimateQty",
  recKgNextMonth: "recQtyNextMonth",
};

const GLOSSARY: { key: string; term: string; explanation: string }[] = [
  { key: "twoMonthsAgoKg", term: "2 months ago", explanation: "Total sold in the full calendar month before last month." },
  { key: "lastMonthKg", term: "Last month", explanation: "Total sold in the previous full calendar month. This is the main number the recommendation is based on." },
  { key: "thisMonthKg", term: "This month (so far)", explanation: "Total sold in the current month up to the latest data available. Not a complete month, so don't compare it directly to the two columns above." },
  { key: "growthPct", term: "Growth (month on month)", explanation: "Compares last month's total to the month before it. Positive means sales are growing; negative means shrinking. This is what pushes next month's recommendation up or down." },
  { key: "thisWeekExampleKg", term: "This week (example)", explanation: "This is not real weekly data -- the source file only reports monthly totals. This column is last month's total spread evenly across a week, shown as a placeholder until real weekly sales data is available." },
  { key: "nextWeekEstimateKg", term: "Next week (estimate)", explanation: "Also not real weekly data. This is next month's recommended total (which already accounts for the growth trend) spread evenly across a week -- a rough guide for the week immediately ahead, not a committed number." },
  { key: "recKgNextMonth", term: "Recommended for next month", explanation: "Last month's total, adjusted for the month-on-month growth trend, plus a safety buffer. This is the number to plan next month's production around." },
];

export default function ForecastPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [months, setMonths] = useState<MonthInfo[]>([]);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [showGlossary, setShowGlossary] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState("lastMonthKg");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [openAlertProducts, setOpenAlertProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products);
        setColumns(data.columns.filter((c: Column) => c.visible));
        setMonths(data.monthsAvailable);
        setDataWarning(data.dataWarning);
        setLoading(false);
      });
    fetch("/api/plans/current")
      .then((r) => r.json())
      .then((data) => {
        const open = data.plan.items
          .filter((i: any) => i.alertStatus !== "ok" && i.decision === "pending")
          .map((i: any) => i.productName);
        setOpenAlertProducts(new Set(open));
      });
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    if (category) list = list.filter((p) => p.category === category);
    if (status) list = list.filter((p) => p.status === status);
    return [...list].sort((a: any, b: any) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return av.localeCompare(bv) * sortDir;
      return (av - bv) * sortDir;
    });
  }, [products, search, category, status, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function exportCsv() {
    const header = columns.map((c) => c.label).join(",");
    const rows = filtered.map((p: any) => columns.map((c) => JSON.stringify(p[c.key] ?? "")).join(","));
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-plan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCell(p: any, col: Column) {
    const val = p[col.key];
    if (col.type === "badge") {
      const hasOpenAlert = openAlertProducts.has(p.name);
      return (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={val} />
          {hasOpenAlert && (
            <Link
              href={`/review?product=${encodeURIComponent(p.name)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[11px] text-brick-strong underline-offset-2 hover:underline whitespace-nowrap"
              title="This product has an open alert needing review"
            >
              ● Review
            </Link>
          )}
        </span>
      );
    }
    if (col.type === "percent")
      return (
        <span className={val >= 0 ? "text-green-strong" : "text-brick-strong"}>
          {val > 0 ? "+" : ""}
          {val}%
        </span>
      );
    if (col.type === "kg") {
      if (val !== null && val !== undefined) return `${val} kg`;
      const qtyKey = KG_TO_QTY[col.key];
      const qtyVal = qtyKey ? p[qtyKey] : undefined;
      return qtyVal !== undefined ? `${qtyVal} units` : "—";
    }
    if (col.key === "category")
      return (
        <span className="block truncate" title={val}>
          {val}
        </span>
      );
    return val;
  }

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Forecast table</div>
      <div className="text-inksoft text-[13.5px] mb-4">
        For each product: what it sold in past months, how the trend is moving, and how much to plan for
        next month. Click "What do these numbers mean?" if anything's unclear.
      </div>

      {months.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-3">
          Data covers: {months.map((m) => `${m.label}${m.isPartial ? " (to date)" : ""}`).join(" · ")}
        </div>
      )}

      {dataWarning && (
        <div className="bg-brick-soft text-brick-strong rounded-lg px-4 py-2.5 text-[13px] mb-5 w-fit">
          ⚠ {dataWarning}
        </div>
      )}

      <button
        className="text-[12.5px] text-green-strong font-medium mb-3 underline-offset-2 hover:underline"
        onClick={() => setShowGlossary((s) => !s)}
      >
        {showGlossary ? "Hide" : "Show"} — what do these numbers mean?
      </button>

      {showGlossary && (
        <div className="bg-surface2 border border-border rounded-lg p-4 mb-5 grid grid-cols-2 gap-3">
          {GLOSSARY.map((g) => (
            <div key={g.key}>
              <div className="text-[12.5px] font-medium text-ink">{g.term}</div>
              <div className="text-[12px] text-inksoft leading-snug mt-0.5">{g.explanation}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex gap-2.5 mb-4 flex-wrap items-center">
          <input
            className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64 shrink-0"
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-48 shrink-0 bg-white"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-40 shrink-0 bg-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ok">On track</option>
            <option value="declining">Declining</option>
            <option value="high_growth">High growth</option>
            <option value="low_data">Low data</option>
          </select>
          <button
            className="ml-auto bg-green-strong text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-green shrink-0"
            onClick={exportCsv}
          >
            Export production plan (CSV)
          </button>
        </div>

        {loading ? (
          <div className="text-inkfaint text-sm py-8 text-center">Loading forecast…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                {columns.map((col) => (
                  <col key={col.key} style={{ width: COLUMN_WIDTH[col.key] ?? "auto" }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => toggleSort(col.key)}
                      className="text-left px-2.5 py-2.5 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong cursor-pointer hover:text-inksoft leading-tight"
                    >
                      {col.label} {sortKey === col.key ? (sortDir === 1 ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr
                    key={p.name}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer hover:bg-surface2 border-b border-border"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-2.5 py-2.5 overflow-hidden">
                        {renderCell(p, col)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && <ProductDrawer product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function ProductDrawer({ product, onClose }: { product: Product; onClose: () => void }) {
  const bars = [
    { label: product.twoMonthsAgoLabel, qty: product.twoMonthsAgoQty, kg: product.twoMonthsAgoKg },
    { label: product.lastMonthLabel, qty: product.lastMonthQty, kg: product.lastMonthKg },
    { label: product.thisMonthLabel, qty: product.thisMonthQty, kg: product.thisMonthKg },
  ];
  const maxQty = Math.max(...bars.map((b) => b.qty), 1);

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div
        className="w-[460px] max-w-[92vw] bg-surface p-7 overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="float-right text-inkfaint text-xl" onClick={onClose}>
          &times;
        </button>
        <div className="font-display text-xl mb-1">{product.name}</div>
        <div className="text-inkfaint text-[11.5px] mb-5">
          {product.category} · SKU {product.sku ?? "—"}
        </div>

        <div className="text-[12px] text-inkfaint mb-2 uppercase tracking-wide">Monthly sales</div>
        <div className="flex items-end gap-3 h-28 mb-1">
          {bars.map((b) => (
            <div key={b.label} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-green rounded-t"
                style={{ height: `${(b.qty / maxQty) * 100}%`, minHeight: b.qty > 0 ? 4 : 0 }}
                title={fmtVal(b.kg, b.qty)}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-3 text-[10.5px] text-inkfaint mb-5">
          {bars.map((b) => (
            <div key={b.label} className="flex-1 text-center">
              {b.label}
            </div>
          ))}
        </div>

        <div className="text-[12px] text-inkfaint mb-2 uppercase tracking-wide">Trend and plan</div>
        <div className="flex gap-2.5 mb-2 flex-wrap">
          <Stat
            label="Growth (month on month)"
            value={`${product.growthPct > 0 ? "+" : ""}${product.growthPct}%`}
            tone={product.growthPct >= 0 ? "green" : "brick"}
          />
          <Stat label="Recommended for next month" value={fmtVal(product.recKgNextMonth, product.recQtyNextMonth)} tone="green" />
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="bg-surface2 rounded-lg px-3.5 py-2.5">
            <div className="text-[11px] text-inkfaint mb-1">This week (example only)</div>
            <div className="font-mono text-base">{fmtVal(product.thisWeekExampleKg, product.thisWeekExampleQty)}</div>
            <div className="text-[10.5px] text-inkfaint mt-1.5">
              Not real weekly data — last month spread evenly across a week.
            </div>
          </div>
          <div className="bg-surface2 rounded-lg px-3.5 py-2.5">
            <div className="text-[11px] text-inkfaint mb-1">Next week (estimate only)</div>
            <div className="font-mono text-base">{fmtVal(product.nextWeekEstimateKg, product.nextWeekEstimateQty)}</div>
            <div className="text-[10.5px] text-inkfaint mt-1.5">
              Also not real weekly data — next month's trend-adjusted number spread across a week.
            </div>
          </div>
        </div>

        {product.status !== "ok" && (
          <div className="bg-amber-soft text-amber-strong rounded-lg p-3.5 text-[12.5px]">{reasonFor(product)}</div>
        )}
      </div>
    </div>
  );
}

function fmtVal(kg: number | null, qty: number): string {
  return kg !== null ? `${kg} kg` : `${qty} units`;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "brick" }) {
  const toneClass = tone === "green" ? "text-green-strong" : tone === "brick" ? "text-brick-strong" : "text-ink";
  return (
    <div className="bg-surface2 rounded-lg px-3.5 py-2.5 flex-1 min-w-[140px]">
      <div className="text-[11px] text-inkfaint mb-1">{label}</div>
      <div className={`font-mono text-base ${toneClass}`}>{value}</div>
    </div>
  );
}

function reasonFor(p: Product) {
  if (p.status === "declining") return `Sales down ${Math.abs(p.growthPct)}% month on month.`;
  if (p.status === "high_growth") return `Sales up ${p.growthPct}% -- confirm supply can keep pace.`;
  if (p.status === "low_data") return `Limited monthly history -- forecast is unreliable until more months build up.`;
  return "";
}
