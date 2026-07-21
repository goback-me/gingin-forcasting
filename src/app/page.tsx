import { computeWeeklyForecast } from "@/lib/weeklyForecast";
import BarList from "@/components/BarList";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const { products, weeksAvailable } = await computeWeeklyForecast();

  const marketProducts = products.filter((p) => p.channel === "Market");
  const onlineProducts = products.filter((p) => p.channel === "Online");

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Overview</div>
      <div className="text-inksoft text-[13.5px] mb-5 max-w-[720px]">
        This tracks how much of each product Gingin sold week by week, and recommends how much to
        prepare next week based on real sales trends -- not an estimate. Broken down by sales channel,
        since market and online demand move differently.
      </div>

      {weeksAvailable.length > 0 && (
        <div className="text-[12.5px] text-inksoft mb-6">
          {weeksAvailable.length} weeks of real sales data: {weeksAvailable[0]?.weekLabel} through{" "}
          {weeksAvailable[weeksAvailable.length - 1]?.weekLabel}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <ChannelSection title="Market" products={marketProducts} />
        <ChannelSection title="Online" products={onlineProducts} />
      </div>

      <div className="bg-surface2 border border-border rounded-lg p-5">
        <div className="font-display text-[15px] mb-2">Where to go next</div>
        <ul className="text-[13px] text-inksoft leading-relaxed list-disc pl-4 space-y-1">
          <li>
            <span className="font-medium text-ink">Forecast table</span> — every product with its real
            weekly sales history and the exact amount, in kg and units, to prepare next week. Filter by
            Market or Online.
          </li>
          <li>
            <span className="font-medium text-ink">This week's plan</span> — go through each product,
            approve or override the recommendation, then lock it in. Separate tabs for Market and Online.
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

function ChannelSection({ title, products }: { title: string; products: any[] }) {
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
    .slice(0, 6)
    .map(([label, value]) => ({ label, value: Math.round(value), unit: "kg" }));

  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <div className="font-display text-[17px] mb-3">{title}</div>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Kpi label="Products" value={totalSkus.toString()} />
        <Kpi
          label="Growth (4wk)"
          value={`${avgGrowth > 0 ? "+" : ""}${avgGrowth}%`}
          tone={avgGrowth >= 0 ? "green" : "brick"}
        />
        <Kpi label="Needs a look" value={alertCount.toString()} tone={alertCount > 0 ? "amber" : "green"} />
      </div>

      <div className="text-[12px] text-inkfaint mb-1.5 uppercase tracking-wide">Top 10 — plan the most of</div>
      <BarList items={top10} />

      {categoryBars.length > 0 && (
        <>
          <div className="text-[12px] text-inkfaint mb-1.5 mt-4 uppercase tracking-wide">By category</div>
          <BarList items={categoryBars} color="#B8842B" />
        </>
      )}

      {totalSkus === 0 && <div className="text-inkfaint text-[12.5px] py-4 text-center">No {title.toLowerCase()} sales data yet.</div>}
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "amber" | "brick";
}) {
  const toneClass =
    tone === "green" ? "text-green-strong" : tone === "amber" ? "text-amber-strong" : tone === "brick" ? "text-brick-strong" : "text-ink";
  return (
    <div className="bg-surface2 border border-border rounded-lg p-2.5">
      <div className="text-[10.5px] text-inkfaint uppercase tracking-wide mb-1">{label}</div>
      <div className={`font-display text-[17px] ${toneClass}`}>{value}</div>
    </div>
  );
}
