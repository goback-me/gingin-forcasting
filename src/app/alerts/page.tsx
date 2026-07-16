import { computeMonthlyForecast, MonthlyProductForecast } from "@/lib/monthlyForecast";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = { declining: "↓", high_growth: "↑", low_data: "?" };

export default async function AlertsPage() {
  const { products } = await computeMonthlyForecast();
  const alerts = products.filter((p) => p.status !== "ok");

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Active alerts</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Products that need a human look before planning next month's production — declining trend,
        unusually high growth, or not enough months of data yet.
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        {alerts.length === 0 && (
          <div className="text-inkfaint text-sm py-6 text-center">No alerts right now — everything's tracking normally.</div>
        )}
        {alerts.map((p) => (
          <div key={p.name} className="flex gap-3.5 py-3.5 border-b border-border last:border-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[15px] badge-${p.status}`}>
              {ICON[p.status]}
            </div>
            <div>
              <div className="text-[13.5px] font-medium">{p.name}</div>
              <div className="text-[12.5px] text-inksoft mt-0.5">{reasonFor(p)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function reasonFor(p: MonthlyProductForecast) {
  if (p.status === "declining")
    return `Sales down ${Math.abs(p.growthPct)}% month on month. Worth a look before next month's production plan.`;
  if (p.status === "high_growth")
    return `Sales up ${p.growthPct}% — recommended stock increased accordingly. Confirm supply can keep pace.`;
  if (p.status === "low_data")
    return `Only one month of data on record — forecast is unreliable until more months build up.`;
  return "";
}
