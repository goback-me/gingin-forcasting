import { computeWeeklyForecast } from "@/lib/weeklyForecast";
import BarList from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { products, weeksAvailable } = await computeWeeklyForecast();

  const totalSkus = products.length;
  const alertCount = products.filter((p) => p.status !== "ok").length;
  const avgGrowth =
    products.length > 0
      ? Math.round((products.reduce((s, p) => s + p.growthPct, 0) / products.length) * 10) / 10
      : 0;

  const top10 = [...products]
    .sort((a, b) => b.recKgNextWeek - a.recKgNextWeek)
    .slice(0, 10)
    .map((p) => ({ label: p.name, value: p.recKgNextWeek, unit: "kg" }));

  const categoryTotals = new Map<string, number>();
  for (const p of products) {
    categoryTotals.set(p.category, (categoryTotals.get(p.category) ?? 0) + p.recKgNextWeek);
  }
  const categoryBars = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value: Math.round(value), unit: "kg" }));

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Overview</div>
      <div className="text-inksoft text-[13.5px] mb-5 max-w-[720px]">
        This tracks how much of each product Gingin sold week by week, and recommends how much to
        prepare next week based on real sales trends -- not an estimate.
      </div>

      {weeksAvailable.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-6">
          {weeksAvailable.length} weeks of real sales data: {weeksAvailable[0]?.weekLabel} through{" "}
          {weeksAvailable[weeksAvailable.length - 1]?.weekLabel}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3.5 mb-6">
        <Kpi label="Products tracked" value={totalSkus.toString()} />
        <Kpi
          label="Growth (4-week trend)"
          value={`${avgGrowth > 0 ? "+" : ""}${avgGrowth}%`}
          tone={avgGrowth >= 0 ? "green" : "brick"}
          note="Average across all products"
        />
        <Kpi label="Products needing a look" value={alertCount.toString()} tone={alertCount > 0 ? "amber" : "green"} note="Declining, spiking, or low on data" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-4 mb-6">
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-display text-[15px] mb-1">Top 10 — plan the most of</div>
          <div className="text-[12px] text-inkfaint mb-3.5">Recommended stock for next week, by product</div>
          <BarList items={top10} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="font-display text-[15px] mb-1">By category</div>
          <div className="text-[12px] text-inkfaint mb-3.5">Recommended stock for next week, grouped</div>
          <BarList items={categoryBars} color="#B8842B" />
        </div>
      </div>

      <div className="bg-surface2 border border-border rounded-lg p-5">
        <div className="font-display text-[15px] mb-2">Where to go next</div>
        <ul className="text-[13px] text-inksoft leading-relaxed list-disc pl-4 space-y-1">
          <li>
            <span className="font-medium text-ink">Forecast table</span> — every product with its real
            weekly sales history and the exact amount, in kg and units, to prepare next week.
          </li>
          <li>
            <span className="font-medium text-ink">This week's plan</span> — go through each product,
            approve or override the recommendation, then lock it in. Every action is tracked permanently.
          </li>
          <li>
            <span className="font-medium text-ink">Scenario planning</span> — test what happens to total
            stock if demand shifts, you run a promo, or you change the safety buffer.
          </li>
          <li>
            <span className="font-medium text-ink">Alerts</span> — products that need a human decision:
            declining trend, sudden spike, or not enough weekly history yet.
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
