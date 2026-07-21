"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ChannelBadge from "@/components/ChannelBadge";

type SeriesPoint = { weekStart: string; weekLabel: string; units: number; kg: number };

type Product = {
  name: string;
  sku: string | null;
  plu: string | null;
  category: string;
  channel: "Market" | "Online";
  marketName: string | null;
  weightG: number | null;
  series: SeriesPoint[];
  dataSource: "weekly" | "monthly" | "both";
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
  thisWeekIsReal: boolean;
  nextWeekEstimateQty: number;
  nextWeekEstimateKg: number | null;
  recQtyNextMonth: number;
  recKgNextMonth: number | null;
  weeksOfHistory: number;
  monthsOfHistory: number;
  status: "ok" | "declining" | "high_growth" | "low_data";
};

type Column = { key: string; label: string; type: string; sortOrder: number };

export default function ForecastPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [monthsAvailable, setMonthsAvailable] = useState<{ month: string; label: string; isPartial: boolean }[]>([]);
  const [dataWarning, setDataWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<string>("nextWeekEstimateKg");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [openAlertProducts, setOpenAlertProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products);
        setColumns(data.columns);
        setMonthsAvailable(data.monthsAvailable);
        setDataWarning(data.dataWarning);
        setLoading(false);
      });
    fetch("/api/plans/current")
      .then((r) => r.json())
      .then((data) => {
        const open = data.plan.items
          .filter((i: any) => i.alertStatus !== "ok" && i.decision === "pending")
          .map((i: any) => `${i.productName}::${i.channel}`);
        setOpenAlertProducts(new Set(open));
      });
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);
  const marketNames = useMemo(
    () => Array.from(new Set(products.filter((p) => p.marketName).map((p) => p.marketName as string))).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.sku ?? "").toLowerCase().includes(q));
    }
    if (category) list = list.filter((p) => p.category === category);
    if (channel) list = list.filter((p) => p.channel === channel);
    if (marketFilter) list = list.filter((p) => p.marketName === marketFilter);
    if (status) list = list.filter((p) => p.status === status);
    return [...list].sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" || typeof bv === "string") {
        return String(av ?? "").localeCompare(String(bv ?? "")) * -sortDir;
      }
      return ((bv ?? 0) - (av ?? 0)) * -sortDir;
    });
  }, [products, search, category, channel, marketFilter, status, sortKey, sortDir]);

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function exportCsv() {
    const header = "Product,SKU,Category,Channel,Market,2 months ago (kg),Last month (kg),This month (kg),Growth %,This week (kg),Next week (kg),Recommended next month (kg),Status";
    const rows = filtered.map(
      (p) =>
        `"${p.name}",${p.sku ?? ""},"${p.category}",${p.channel},${p.marketName ?? ""},${p.twoMonthsAgoKg ?? ""},${p.lastMonthKg ?? ""},${p.thisMonthKg ?? ""},${p.growthPct},${p.thisWeekExampleKg ?? ""},${p.nextWeekEstimateKg ?? ""},${p.recKgNextMonth ?? ""},${p.status}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderCell(p: Product, col: Column) {
    const val = (p as any)[col.key];

    if (col.key === "channel") return <ChannelBadge channel={p.channel} />;
    if (col.key === "marketName") return <span className="text-inksoft">{p.marketName ?? "—"}</span>;

    if (col.type === "badge" && col.key === "status") {
      const hasOpenAlert = openAlertProducts.has(`${p.name}::${p.channel}`);
      return (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={val} />
          {hasOpenAlert && (
            <Link
              href={`/review?product=${encodeURIComponent(p.name)}&channel=${p.channel}`}
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
      if (val === null || val === undefined) return <span className="text-inkfaint">—</span>;
      const isEstimateCol = col.key === "thisWeekExampleKg" && !p.thisWeekIsReal;
      return (
        <span>
          {val} kg
          {isEstimateCol && <span className="text-[10px] text-inkfaint ml-1">(estimate)</span>}
        </span>
      );
    }

    return val ?? "—";
  }

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Forecast table</div>
      <div className="text-inksoft text-[13.5px] mb-4">
        Every product, combining the monthly sales report with real weekly data where it exists. Filter
        by channel to see Market or Online separately.
      </div>

      {monthsAvailable.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-4">
          {monthsAvailable.length} months of data: {monthsAvailable[0]?.label} through{" "}
          {monthsAvailable[monthsAvailable.length - 1]?.label}
        </div>
      )}

      {dataWarning && (
        <div className="bg-amber-soft text-amber-strong rounded-lg px-3.5 py-2.5 text-[12.5px] mb-4">{dataWarning}</div>
      )}

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex gap-2.5 mb-4 flex-wrap items-center">
          <input
            className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64"
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-48 bg-white"
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
            className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-36 bg-white"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setMarketFilter("");
            }}
          >
            <option value="">Market + Online</option>
            <option value="Market">Market only</option>
            <option value="Online">Online only</option>
          </select>
          {channel === "Market" && marketNames.length > 0 && (
            <select
              className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-40 bg-white"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
            >
              <option value="">All markets</option>
              {marketNames.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <select
            className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-40 bg-white"
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
            className="ml-auto bg-green-strong text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-green"
            onClick={exportCsv}
          >
            Export (CSV)
          </button>
        </div>

        {loading ? (
          <div className="text-inkfaint text-sm py-8 text-center">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
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
                    key={`${p.name}::${p.channel}`}
                    onClick={() => setSelected(p)}
                    className="cursor-pointer hover:bg-surface2 border-b border-border"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-2.5 py-2.5">
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
  const hasWeekly = product.series.length > 0;
  const maxKg = hasWeekly ? Math.max(...product.series.map((s) => s.kg), 1) : 1;

  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] bg-surface p-7 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="float-right text-inkfaint text-xl" onClick={onClose}>
          &times;
        </button>
        <div className="font-display text-xl mb-1">{product.name}</div>
        <div className="text-inkfaint text-[11.5px] mb-5 flex items-center gap-2 flex-wrap">
          <span>
            {product.category}
            {product.sku && <> · SKU {product.sku}</>}
          </span>
          <ChannelBadge channel={product.channel} />
          {product.marketName && <span className="text-[11px] text-inkfaint">{product.marketName}</span>}
        </div>

        {hasWeekly ? (
          <>
            <div className="text-[12px] text-inkfaint mb-2 uppercase tracking-wide">Weekly sales (kg)</div>
            <div className="flex items-end gap-1 h-32 mb-1">
              {product.series.map((s) => (
                <div key={s.weekStart} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className="w-full bg-green rounded-t"
                    style={{ height: `${(s.kg / maxKg) * 100}%`, minHeight: s.kg > 0 ? 3 : 0 }}
                    title={`${s.weekLabel}: ${s.kg} kg`}
                  />
                </div>
              ))}
            </div>
            <div className="text-[10.5px] text-inkfaint flex justify-between mb-5">
              <span>{product.series[0]?.weekLabel}</span>
              <span>{product.series[product.series.length - 1]?.weekLabel}</span>
            </div>
          </>
        ) : (
          <div className="bg-surface2 border border-border rounded-lg px-3.5 py-3 mb-5 text-[12.5px] text-inksoft">
            No real weekly sales data for this product yet — numbers below come from the monthly report
            only.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Stat label="2 months ago" value={product.twoMonthsAgoKg !== null ? `${product.twoMonthsAgoKg} kg` : "—"} sub={product.twoMonthsAgoLabel} />
          <Stat label="Last month" value={product.lastMonthKg !== null ? `${product.lastMonthKg} kg` : "—"} sub={product.lastMonthLabel} />
          <Stat label="This month" value={product.thisMonthKg !== null ? `${product.thisMonthKg} kg` : "—"} sub={product.thisMonthLabel} />
          <Stat
            label="Growth"
            value={`${product.growthPct > 0 ? "+" : ""}${product.growthPct}%`}
            tone={product.growthPct >= 0 ? "green" : "brick"}
          />
        </div>

        <div className="bg-green-soft rounded-lg px-3.5 py-3 mb-3">
          <div className="text-[11px] text-green-strong/80 mb-1">
            {product.thisWeekIsReal ? "This week (real)" : "This week (estimate)"}
          </div>
          <div className="font-display text-lg text-green-strong">
            {product.thisWeekExampleKg !== null ? `${product.thisWeekExampleKg} kg` : `${product.thisWeekExampleQty} units`}
          </div>
        </div>

        <div className="bg-green-soft rounded-lg px-3.5 py-3 mb-4">
          <div className="text-[11px] text-green-strong/80 mb-1">Recommended next week</div>
          <div className="font-display text-xl text-green-strong">
            {product.nextWeekEstimateKg !== null ? `${product.nextWeekEstimateKg} kg` : `${product.nextWeekEstimateQty} units`}
          </div>
        </div>

        <div className="text-[12px] text-inkfaint">
          Recommended for the month ahead:{" "}
          <span className="font-mono">{product.recKgNextMonth !== null ? `${product.recKgNextMonth} kg` : `${product.recQtyNextMonth} units`}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "green" | "brick"; sub?: string }) {
  const toneClass = tone === "green" ? "text-green-strong" : tone === "brick" ? "text-brick-strong" : "text-ink";
  return (
    <div className="bg-surface2 rounded-lg px-3.5 py-2.5">
      <div className="text-[11px] text-inkfaint mb-1">{label}</div>
      <div className={`font-mono text-base ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10.5px] text-inkfaint mt-0.5">{sub}</div>}
    </div>
  );
}
