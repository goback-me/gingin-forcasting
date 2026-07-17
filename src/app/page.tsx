import { computeMonthlyForecast } from "@/lib/monthlyForecast";
import BarList from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { products, monthsAvailable, dataWarning } = await computeMonthlyForecast();

  const totalSkus = products.length;
  const alertCount = products.filter((p) => p.status !== "ok").length;
  const avgGrowth =
    products.length > 0
      ? Math.round((products.reduce((s, p) => s + p.growthPct, 0) / products.length) * 10) / 10
      : 0;

  const top10 = [...products]
    .sort((a, b) => (b.recKgNextMonth ?? b.recQtyNextMonth) - (a.recKgNextMonth ?? a.recQtyNextMonth))
    .slice(0, 10)
    .map((p) => ({
      label: p.name,
      value: p.recKgNextMonth ?? p.recQtyNextMonth,
      unit: p.recKgNextMonth !== null ? "kg" : "units",
    }));

  // Summed per category using whichever unit that category's products
  // actually have -- kg if every product there has a known weight,
  // otherwise raw units. Mixing kg and unit counts in one sum would be
  // silently wrong, so this keeps them separate rather than guessing.
  const categoryTotals = new Map<string, { value: number; allKg: boolean }>();
  for (const p of products) {
    const existing = categoryTotals.get(p.category) ?? { value: 0, allKg: true };
    const hasKg = p.recKgNextMonth !== null;
    existing.value += hasKg ? p.recKgNextMonth! : p.recQtyNextMonth;
    existing.allKg = existing.allKg && hasKg;
    categoryTotals.set(p.category, existing);
  }
  const categoryBars = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1].value - a[1].value)
    .slice(0, 8)
    .map(([label, { value, allKg }]) => ({
      label,
      value: Math.round(value),
      unit: allKg ? "kg" : "units",
    }));

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Overview</div>
      <div className="text-inksoft text-[13.5px] mb-5 max-w-[720px]">
        This tracks how much of each product Gingin sold over the last few months, and recommends how
        much to plan for next month's production based on the trend.
      </div>

      {monthsAvailable.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-3">
          Data covers: {monthsAvailable.map((m) => `${m.label}${m.isPartial ? " (to date)" : ""}`).join(" · ")}
        </div>
      )}

      {dataWarning && (
        <div className="bg-brick-soft text-brick-strong rounded-lg px-4 py-2.5 text-[13px] mb-6 w-fit">
          ⚠ {dataWarning}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <Kpi label="Products tracked" value={totalSkus.toString()} />
        <Kpi
          label="Growth (month on month)"
          value={`${avgGrowth > 0 ? "+" : ""}${avgGrowth}%`}
          tone={avgGrowth >= 0 ? "green" : "brick"}
          note="Average across all products"
        />
        <Kpi label="Products needing a look" value={alertCount.toString()} tone={alertCount > 0 ? "amber" : "green"} note="Declining, spiking, or low on data" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-display text-[15px] mb-1">Top 10 — plan the most of</div>
          <div className="text-[12px] text-inkfaint mb-3.5">Recommended stock for next month, by product</div>
          <BarList items={top10} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-display text-[15px] mb-1">By category</div>
          <div className="text-[12px] text-inkfaint mb-3.5">Recommended stock for next month, grouped</div>
          <BarList items={categoryBars} color="#B8842B" />
        </div>
      </div>

      <div className="bg-surface2 border border-border rounded-lg p-5">
        <div className="font-display text-[15px] mb-2">Where to go next</div>
        <ul className="text-[13px] text-inksoft leading-relaxed list-disc pl-4 space-y-1">
          <li>
            <span className="font-medium text-ink">Forecast table</span> — every product with its monthly
            sales history and the amount to plan for next month. Has a full glossary of every column.
          </li>
          <li>
            <span className="font-medium text-ink">Scenario planning</span> — test what happens to total
            stock if demand shifts, you run a promo, or you change the safety buffer.
          </li>
          <li>
            <span className="font-medium text-ink">Alerts</span> — products that need a human decision:
            declining trend, sudden spike, or not enough monthly history yet.
          </li>
        </ul>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "brick";
  note?: string;
}) {
  const toneClass =
    tone === "green" ? "text-green-strong" : tone === "amber" ? "text-amber-strong" : tone === "brick" ? "text-brick-strong" : "text-ink";
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="text-[12px] text-inkfaint uppercase tracking-wide mb-2">{label}</div>
      <div className={`font-display text-[26px] ${toneClass}`}>{value}</div>
      {note && <div className="text-[11.5px] text-inkfaint mt-1.5">{note}</div>}
    </div>
  );
}
