"use client";
import { useEffect, useMemo, useState } from "react";

type ProductRow = { name: string; category: string; recKgNextMonth: number | null; recQtyNextMonth: number };

export default function ScenarioPage() {
  const [demandPct, setDemandPct] = useState(0);
  const [promoPct, setPromoPct] = useState(0);
  const [bufferPct, setBufferPct] = useState(10);
  const [baselineProducts, setBaselineProducts] = useState<ProductRow[]>([]);
  const [scenarioProducts, setScenarioProducts] = useState<ProductRow[]>([]);

  useEffect(() => {
    fetch("/api/products?demandPct=0&promoPct=0&bufferPct=10")
      .then((r) => r.json())
      .then((data) => setBaselineProducts(data.products));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/products?demandPct=${demandPct}&promoPct=${promoPct}&bufferPct=${bufferPct}`)
        .then((r) => r.json())
        .then((data) => setScenarioProducts(data.products));
    }, 250);
    return () => clearTimeout(t);
  }, [demandPct, promoPct, bufferPct]);

  const baseline = useMemo(() => totalKg(baselineProducts), [baselineProducts]);
  const scenario = useMemo(() => totalKg(scenarioProducts), [scenarioProducts]);
  const delta = baseline !== null && scenario !== null ? scenario - baseline : null;

  // Per-product deltas -- this is the part that actually answers "which
  // products drive the change", not just the one combined number.
  const movers = useMemo(() => {
    if (!baselineProducts.length || !scenarioProducts.length) return [];
    const baseByName = new Map(baselineProducts.map((p) => [p.name, valOf(p)]));
    return scenarioProducts
      .map((p) => {
        const base = baseByName.get(p.name) ?? 0;
        const scen = valOf(p);
        return { name: p.name, category: p.category, base, scen, delta: scen - base };
      })
      .filter((m) => Math.abs(m.delta) > 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 15);
  }, [baselineProducts, scenarioProducts]);

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Scenario planning</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Test how next month's total recommended stock would change under different conditions. This is a
        sandbox — it doesn't touch the saved forecast.
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 max-w-[640px] mb-5">
        <Slider label="Demand uplift / drop" value={demandPct} min={-30} max={60} onChange={setDemandPct} />
        <Slider label="Promo campaign boost" value={promoPct} min={0} max={80} onChange={setPromoPct} />
        <Slider label="Safety buffer" value={bufferPct} min={0} max={40} onChange={setBufferPct} />

        <div className="grid grid-cols-3 gap-3 mt-5">
          <ImpactCard label="Baseline (kg) — everything combined" value={baseline !== null ? baseline.toLocaleString() : "—"} />
          <ImpactCard label="Scenario (kg) — everything combined" value={scenario !== null ? scenario.toLocaleString() : "—"} />
          <ImpactCard
            label="Change"
            value={delta !== null ? `${delta > 0 ? "+" : ""}${delta.toLocaleString()}` : "—"}
          />
        </div>
      </div>

      {movers.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5 max-w-[720px]">
          <div className="font-display text-[15px] mb-1">Which products drive that change</div>
          <div className="text-[12px] text-inkfaint mb-3.5">
            Sorted by biggest impact, baseline vs this scenario. This is the per-product breakdown behind
            the combined number above.
          </div>
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr>
                <th className="text-left px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Product</th>
                <th className="text-right px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Baseline</th>
                <th className="text-right px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Scenario</th>
                <th className="text-right px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Change</th>
              </tr>
            </thead>
            <tbody>
              {movers.map((m) => (
                <tr key={m.name} className="border-b border-border">
                  <td className="px-2 py-2">{m.name}</td>
                  <td className="px-2 py-2 text-right font-mono">{Math.round(m.base).toLocaleString()}</td>
                  <td className="px-2 py-2 text-right font-mono">{Math.round(m.scen).toLocaleString()}</td>
                  <td className={`px-2 py-2 text-right font-mono ${m.delta >= 0 ? "text-green-strong" : "text-brick-strong"}`}>
                    {m.delta > 0 ? "+" : ""}
                    {Math.round(m.delta).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function valOf(p: ProductRow): number {
  return p.recKgNextMonth ?? p.recQtyNextMonth ?? 0;
}

function totalKg(products: ProductRow[]): number {
  return Math.round(products.reduce((sum, p) => sum + valOf(p), 0));
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <label className="text-[13px] text-inksoft w-[190px] shrink-0">{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
      />
      <span className="font-mono text-[13px] w-12 text-right">{value}%</span>
    </div>
  );
}

function ImpactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-green-soft rounded-lg px-4 py-3.5">
      <div className="text-[11.5px] text-green-strong/80">{label}</div>
      <div className="font-display text-[22px] text-green-strong mt-1">{value}</div>
    </div>
  );
}