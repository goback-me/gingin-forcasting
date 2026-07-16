import { NextResponse } from "next/server";
import { computeMonthlyForecast, MonthlyProductForecast } from "@/lib/monthlyForecast";

export const dynamic = "force-dynamic";

export async function GET() {
  const { products } = await computeMonthlyForecast();

  const alerts = products
    .filter((p) => p.status !== "ok")
    .map((p) => ({
      product: p.name,
      sku: p.sku,
      severity: p.status,
      reason: reasonFor(p),
    }));

  return NextResponse.json({ alerts });
}

function reasonFor(p: MonthlyProductForecast) {
  if (p.status === "declining") {
    return `Sales down ${Math.abs(p.growthPct)}% month on month. Worth a look before next month's production plan.`;
  }
  if (p.status === "high_growth") {
    return `Sales up ${p.growthPct}% -- recommended stock increased accordingly, but confirm supply can keep pace.`;
  }
  if (p.status === "low_data") {
    return `Only one month of data on record for this product -- forecast is unreliable until more months build up.`;
  }
  return "";
}
