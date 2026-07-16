"use client";
import { useEffect, useState } from "react";

export default function ScenarioPage() {
  const [demandPct, setDemandPct] = useState(0);
  const [promoPct, setPromoPct] = useState(0);
  const [bufferPct, setBufferPct] = useState(10);
  const [baseline, setBaseline] = useState<number | null>(null);
  const [scenario, setScenario] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/products?demandPct=0&promoPct=0&bufferPct=10")
      .then((r) => r.json())
      .then((data) => setBaseline(totalKg(data.products)));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/products?demandPct=${demandPct}&promoPct=${promoPct}&bufferPct=${bufferPct}`)
        .then((r) => r.json())
        .then((data) => setScenario(totalKg(data.products)));
    }, 250);
    return () => clearTimeout(t);
  }, [demandPct, promoPct, bufferPct]);

  const delta = baseline !== null && scenario !== null ? scenario - baseline : null;

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Scenario planning</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Test how next month's total recommended stock would change under different conditions. This is a
        sandbox — it doesn't touch the saved forecast.
      </div>

      <div className="bg-surface border border-border rounded-lg p-6 max-w-[640px]">
        <Slider
          label="Demand uplift / drop"
          value={demandPct}
          min={-30}
          max={60}
          onChange={setDemandPct}
        />
        <Slider label="Promo campaign boost" value={promoPct} min={0} max={80} onChange={setPromoPct} />
        <Slider label="Safety buffer" value={bufferPct} min={0} max={40} onChange={setBufferPct} />

        <div className="grid grid-cols-3 gap-3 mt-5">
          <ImpactCard label="Baseline (kg)" value={baseline !== null ? baseline.toLocaleString() : "—"} />
          <ImpactCard label="Scenario (kg)" value={scenario !== null ? scenario.toLocaleString() : "—"} />
          <ImpactCard
            label="Change"
            value={delta !== null ? `${delta > 0 ? "+" : ""}${delta.toLocaleString()}` : "—"}
          />
        </div>
      </div>
    </div>
  );
}

function totalKg(products: any[]): number {
  return Math.round(products.reduce((sum, p) => sum + (p.recKgNextMonth ?? p.recQtyNextMonth ?? 0), 0));
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
