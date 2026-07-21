"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import ChannelBadge from "@/components/ChannelBadge";

type WeekPoint = { weekStart: string; weekLabel: string; units: number; kg: number };
type Product = {
  name: string;
  plu: string;
  category: string;
  channel: "Market" | "Online";
  series: WeekPoint[];
  lastWeekKg: number;
  lastWeekUnits: number;
  lastWeekLabel: string;
  priorWeekKg: number;
  priorWeekUnits: number;
  priorWeekLabel: string;
  avgLast4Kg: number;
  avgLast4Units: number;
  avgPrior4Kg: number | null;
  growthPct: number;
  avgWeightPerUnitKg: number | null;
  recKgNextWeek: number;
  recUnitsNextWeek: number | null;
  recKgNextMonth: number;
  recUnitsNextMonth: number | null;
  weeksOfHistory: number;
  status: string;
};

const GLOSSARY = [
  { term: "Last week", explanation: "Actual kg (and units) sold in the most recent week of real data." },
  { term: "4-week average", explanation: "Trailing 4-week average, smoothing out single-week noise -- this is the baseline the recommendation is built from." },
  { term: "Growth (4wk trend)", explanation: "This 4-week average vs the 4 weeks before it. Positive means demand is growing; negative means it's easing off." },
  { term: "kg per unit", explanation: "How much one pack/unit of this specific product actually weighs, on average -- calculated from its own real sales, not assumed." },
  { term: "Recommended next week", explanation: "The 4-week average, adjusted for the growth trend, plus a safety buffer -- shown in both kg and units. Real, not an estimate." },
];

export default function ForecastPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [weeksAvailable, setWeeksAvailable] = useState<{ weekStart: string; weekLabel: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGlossary, setShowGlossary] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<keyof Product>("recKgNextWeek");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<Product | null>(null);
  const [openAlertProducts, setOpenAlertProducts] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { approvedQty: number; approvedKg: number | null }>>({});

  useEffect(() => {
    fetch("/api/weekly-products")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products);
        setWeeksAvailable(data.weeksAvailable);
        setLoading(false);
      });
    fetch("/api/plans/current")
      .then((r) => r.json())
      .then((data) => {
        const open = data.plan.items
          .filter((i: any) => i.alertStatus !== "ok" && i.decision === "pending")
          .map((i: any) => i.productName);
        setOpenAlertProducts(new Set(open));

        const overrideMap: Record<string, { approvedQty: number; approvedKg: number | null }> = {};
        for (const i of data.plan.items) {
          if (i.decision === "overridden") {
            overrideMap[i.productName] = { approvedQty: i.approvedQty, approvedKg: i.approvedKg };
          }
        }
        setOverrides(overrideMap);
      });
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category))).sort(), [products]);

  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.plu.includes(q));
    }
    if (category) list = list.filter((p) => p.category === category);
    if (channel) list = list.filter((p) => p.channel === channel);
    if (status) list = list.filter((p) => p.status === status);
    return [...list].sort((a: any, b: any) => (b[sortKey] - a[sortKey]) * -sortDir);
  }, [products, search, category, channel, status, sortKey, sortDir]);

  function toggleSort(key: keyof Product) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(-1);
    }
  }

  function exportCsv() {
    const header =
      "Product,PLU,Category,Channel,Last week (kg),Last week (units),4wk avg (kg),4wk avg (units),Growth %,kg per unit,Recommended next week (kg),Recommended next week (units),Status";
    const rows = filtered.map(
      (p) =>
        `"${p.name}",${p.plu},"${p.category}",${p.channel},${p.lastWeekKg},${p.lastWeekUnits},${p.avgLast4Kg},${p.avgLast4Units},${p.growthPct},${p.avgWeightPerUnitKg ?? ""},${p.recKgNextWeek},${p.recUnitsNextWeek ?? ""},${p.status}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `production-plan-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Forecast table</div>
      <div className="text-inksoft text-[13.5px] mb-4">
        Real week-by-week sales data -- no placeholders. For each product: what it sold, how the trend is
        moving, and exactly how much to prepare next week, in both kg and units.
      </div>

      {weeksAvailable.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-4">
          {weeksAvailable.length} weeks of data: {weeksAvailable[0]?.weekLabel} through{" "}
          {weeksAvailable[weeksAvailable.length - 1]?.weekLabel}
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
            <div key={g.term}>
              <div className="text-[12.5px] font-medium text-ink">{g.term}</div>
              <div className="text-[12px] text-inksoft leading-snug mt-0.5">{g.explanation}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex gap-2.5 mb-4 flex-wrap items-center">
          <input
            className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64"
            placeholder="Search product or PLU…"
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
            onChange={(e) => setChannel(e.target.value)}
          >
            <option value="">Market + Online</option>
            <option value="Market">Market only</option>
            <option value="Online">Online only</option>
          </select>
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
            Export production plan (CSV)
          </button>
        </div>

        {loading ? (
          <div className="text-inkfaint text-sm py-8 text-center">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr>
                  {[
                    ["name", "Product"],
                    ["category", "Category"],
                    ["channel", "Channel"],
                    ["lastWeekKg", "Last week"],
                    ["avgLast4Kg", "4-week average"],
                    ["growthPct", "Growth (4wk trend)"],
                    ["avgWeightPerUnitKg", "kg per unit"],
                    ["recKgNextWeek", "Recommended next week"],
                    ["status", "Status"],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key as keyof Product)}
                      className="text-left px-2.5 py-2.5 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong cursor-pointer hover:text-inksoft leading-tight"
                    >
                      {label} {sortKey === key ? (sortDir === 1 ? "↑" : "↓") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const override = overrides[p.name];
                  const hasOpenAlert = openAlertProducts.has(p.name);
                  return (
                    <tr key={`${p.name}::${p.channel}`} onClick={() => setSelected(p)} className="cursor-pointer hover:bg-surface2 border-b border-border">
                      <td className="px-2.5 py-2.5">{p.name}</td>
                      <td className="px-2.5 py-2.5 text-inksoft">
                        <span className="block truncate max-w-[140px]" title={p.category}>
                          {p.category}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <ChannelBadge channel={p.channel} />
                      </td>
                      <td className="px-2.5 py-2.5">
                        {p.lastWeekKg} kg
                        <div className="text-[11px] text-inkfaint">{p.lastWeekUnits} units</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        {p.avgLast4Kg} kg
                        <div className="text-[11px] text-inkfaint">{p.avgLast4Units} units</div>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span className={p.growthPct >= 0 ? "text-green-strong" : "text-brick-strong"}>
                          {p.growthPct > 0 ? "+" : ""}
                          {p.growthPct}%
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-inksoft">
                        {p.avgWeightPerUnitKg !== null ? `${p.avgWeightPerUnitKg} kg` : "—"}
                      </td>
                      <td className="px-2.5 py-2.5 font-medium">
                        {override ? (
                          <span className="whitespace-nowrap">
                            <span className="line-through text-inkfaint text-[12px] mr-1.5 font-normal">
                              {p.recKgNextWeek} kg
                            </span>
                            <span className="text-amber-strong">
                              {override.approvedKg !== null ? `${override.approvedKg} kg` : `${override.approvedQty} units`}
                            </span>
                            <span className="badge badge-high_growth ml-1.5">overridden</span>
                          </span>
                        ) : (
                          <>
                            {p.recKgNextWeek} kg
                            <div className="text-[11px] text-inkfaint font-normal">
                              {p.recUnitsNextWeek !== null ? `${p.recUnitsNextWeek} units` : "no unit data"}
                            </div>
                          </>
                        )}
                      </td>
                      <td className="px-2.5 py-2.5">
                        <span className="flex flex-col items-start gap-0.5">
                          <StatusBadge status={p.status} />
                          <Link
                            href={`/review?product=${encodeURIComponent(p.name)}&channel=${p.channel}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`text-[10.5px] underline-offset-2 hover:underline whitespace-nowrap ${
                              hasOpenAlert ? "text-brick-strong" : "text-inkfaint"
                            }`}
                            title={hasOpenAlert ? "This product has an open alert needing review" : "Review or override this product"}
                          >
                            {hasOpenAlert ? "● Review" : "Review"}
                          </Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
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
  const maxKg = Math.max(...product.series.map((s) => s.kg), 1);
  return (
    <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={onClose}>
      <div className="w-[480px] max-w-[92vw] bg-surface p-7 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <button className="float-right text-inkfaint text-xl" onClick={onClose}>
          &times;
        </button>
        <div className="font-display text-xl mb-1">{product.name}</div>
        <div className="text-inkfaint text-[11.5px] mb-5 flex items-center gap-2">
          <span>
            {product.category} · PLU {product.plu} · {product.weeksOfHistory} weeks of history
          </span>
          <ChannelBadge channel={product.channel} />
        </div>

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

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Stat label="Last week" value={`${product.lastWeekKg} kg`} sub={`${product.lastWeekUnits} units`} />
          <Stat label="Prior week" value={`${product.priorWeekKg} kg`} sub={`${product.priorWeekUnits} units`} />
          <Stat
            label="Growth (4wk trend)"
            value={`${product.growthPct > 0 ? "+" : ""}${product.growthPct}%`}
            tone={product.growthPct >= 0 ? "green" : "brick"}
          />
          <Stat
            label="kg per unit"
            value={product.avgWeightPerUnitKg !== null ? `${product.avgWeightPerUnitKg} kg` : "—"}
            sub="from this product's own history"
          />
        </div>
        <div className="bg-green-soft rounded-lg px-3.5 py-3 mb-4">
          <div className="text-[11px] text-green-strong/80 mb-1">Recommended next week</div>
          <div className="font-display text-xl text-green-strong">{product.recKgNextWeek} kg</div>
          <div className="text-[12.5px] text-green-strong/90 mt-0.5">
            {product.recUnitsNextWeek !== null ? `≈ ${product.recUnitsNextWeek} units to prepare` : "no unit conversion available"}
          </div>
        </div>
        <div className="text-[12px] text-inkfaint">
          Recommended for the month ahead:{" "}
          <span className="font-mono">{product.recKgNextMonth} kg</span>
          {product.recUnitsNextMonth !== null && <span className="font-mono"> ({product.recUnitsNextMonth} units)</span>}
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