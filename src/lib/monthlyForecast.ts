import { prisma } from "./db";
import { computeWeeklyForecast, WeeklyProductForecast } from "./weeklyForecast";

type MonthlyRow = {
  month: string;
  monthLabel: string;
  isPartial: boolean;
  productName: string;
  sku: string | null;
  channel: string;
  marketName: string | null;
  itemsSold: number;
};

export interface MonthlyProductForecast {
  name: string;
  sku: string | null;
  plu: string | null;
  category: string;
  channel: "Market" | "Online";
  marketName: string | null;
  weightG: number | null;
  series: { weekStart: string; weekLabel: string; units: number; kg: number }[];

  // Which source(s) this row's numbers are built from -- "both" means the
  // weekly numbers (more precise) are used for growth/recommendation,
  // while the monthly columns below still come from the monthly report.
  dataSource: "weekly" | "monthly" | "both";

  twoMonthsAgoQty: number;
  twoMonthsAgoKg: number | null;
  twoMonthsAgoLabel: string;

  lastMonthQty: number;
  lastMonthKg: number | null;
  lastMonthLabel: string;

  thisMonthQty: number; // partial -- "to date"
  thisMonthKg: number | null;
  thisMonthLabel: string;

  growthPct: number; // weekly 4wk trend when available, else month-over-month

  // Real last week's numbers when weekly data exists for this product;
  // otherwise a rough estimate (last month's total spread over ~4.33
  // weeks) -- thisWeekIsReal tells the UI which one it's looking at.
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
}

export interface MonthlyForecastResult {
  products: MonthlyProductForecast[];
  monthsAvailable: { month: string; label: string; isPartial: boolean }[];
  dataWarning: string | null;
}

function statusFor(monthsWithData: number, growthPct: number): MonthlyProductForecast["status"] {
  if (monthsWithData < 2) return "low_data";
  if (growthPct <= -15) return "declining";
  if (growthPct >= 40) return "high_growth";
  return "ok";
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function computeMonthlyForecast(
  levers?: { demandPct?: number; promoPct?: number; bufferPct?: number }
): Promise<MonthlyForecastResult> {
  const rows = (await prisma.monthlySales.findMany()) as MonthlyRow[];

  const buffer = levers?.bufferPct !== undefined ? levers.bufferPct / 100 : 0.1;
  const demandMult = 1 + (levers?.demandPct ?? 0) / 100;
  const promoMult = 1 + (levers?.promoPct ?? 0) / 100;

  const monthKeys = Array.from(new Set(rows.map((r) => r.month))).sort();
  const monthsAvailable = monthKeys.map((month) => {
    const row = rows.find((r) => r.month === month)!;
    return { month, label: row.monthLabel, isPartial: row.isPartial };
  });

  const currentMonth = monthsAvailable.find((m) => m.isPartial) ?? monthsAvailable[monthsAvailable.length - 1];
  const currentIdx = monthKeys.indexOf(currentMonth?.month ?? "");
  const lastMonthKey = currentIdx > 0 ? monthKeys[currentIdx - 1] : null;
  const twoMonthsAgoKey = currentIdx > 1 ? monthKeys[currentIdx - 2] : null;

  let dataWarning: string | null = null;
  if (lastMonthKey && currentMonth) {
    const lastTotal = rows.filter((r) => r.month === lastMonthKey).reduce((s, r) => s + r.itemsSold, 0);
    const curTotal = rows.filter((r) => r.month === currentMonth.month).reduce((s, r) => s + r.itemsSold, 0);
    const lastRows = rows.filter((r) => r.month === lastMonthKey).length;
    const curRows = rows.filter((r) => r.month === currentMonth.month).length;
    if (lastTotal === curTotal && lastRows === curRows && lastTotal > 0) {
      dataWarning = `${currentMonth.label} looks identical to the previous month -- this export may not have been refreshed. Numbers below may be stale.`;
    }
  }

  // Bucket monthly rows by product+channel
  const byKey = new Map<string, MonthlyRow[]>();
  for (const row of rows) {
    const key = `${row.productName}::${row.channel}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  // Pull the weekly engine's results and index by the same key
  const { products: weeklyProducts } = await computeWeeklyForecast(levers);
  const weeklyByKey = new Map<string, WeeklyProductForecast>();
  for (const wp of weeklyProducts) {
    weeklyByKey.set(`${wp.name}::${wp.channel}`, wp);
  }

  const allKeys = new Set<string>([...byKey.keys(), ...weeklyByKey.keys()]);
  const products: MonthlyProductForecast[] = [];

  for (const key of allKeys) {
    const monthlyRows = byKey.get(key);
    const weekly = weeklyByKey.get(key);
    const name = monthlyRows?.[0]?.productName ?? weekly!.name;
    const channel = (monthlyRows?.[0]?.channel ?? weekly!.channel) as "Market" | "Online";
    const marketName = monthlyRows?.[0]?.marketName ?? weekly?.marketName ?? null;

    const qtyFor = (month: string | null) =>
      month && monthlyRows ? monthlyRows.find((r) => r.month === month)?.itemsSold ?? 0 : 0;
    const skuFor = monthlyRows?.find((r) => r.sku)?.sku ?? null;

    const enrichment = await prisma.orderItem.findFirst({
      where: { productName: name },
      select: { weightG: true, category: true },
      orderBy: { id: "desc" },
    });
    const weightG = enrichment?.weightG ?? null;
    const category = weekly?.category ?? enrichment?.category ?? "Uncategorised";

    const twoMonthsAgoQty = qtyFor(twoMonthsAgoKey);
    const lastMonthQty = qtyFor(lastMonthKey);
    const thisMonthQty = qtyFor(currentMonth?.month ?? null);

    const toKg = (qty: number) => (weightG ? round1((qty * weightG) / 1000) : null);

    const monthlyGrowthPct = twoMonthsAgoQty > 0 ? round1((lastMonthQty / twoMonthsAgoQty - 1) * 100) : 0;
    const monthlyGrowthFactor = 1 + monthlyGrowthPct / 100;

    const monthlyThisWeekExampleQty = Math.round(lastMonthQty / 4.33);
    const monthlyScenarioAdjusted = lastMonthQty * monthlyGrowthFactor * demandMult * promoMult * (1 + buffer);
    const monthlyNextWeekEstimateQty = Math.round(monthlyScenarioAdjusted / 4.33);
    const monthlyRecQtyNextMonth = Math.round(monthlyScenarioAdjusted);

    const dataSource: MonthlyProductForecast["dataSource"] = weekly && monthlyRows ? "both" : weekly ? "weekly" : "monthly";

    // Prefer the weekly engine's numbers wherever real weekly data exists --
    // they're built from actual per-week sales, not a monthly average spread
    // out. The monthly columns (2 months ago / last month / this month)
    // always come from the monthly report itself, since that's the only
    // source with that exact shape.
    const growthPct = weekly ? weekly.growthPct : monthlyGrowthPct;
    const status = weekly ? weekly.status : statusFor(monthlyRows?.length ?? 0, monthlyGrowthPct);

    const thisWeekIsReal = !!weekly;
    const thisWeekExampleQty = weekly ? weekly.lastWeekUnits : monthlyThisWeekExampleQty;
    const thisWeekExampleKg = weekly ? weekly.lastWeekKg : toKg(monthlyThisWeekExampleQty);

    const nextWeekEstimateQty = weekly ? weekly.recUnitsNextWeek ?? Math.round(weekly.recKgNextWeek) : monthlyNextWeekEstimateQty;
    const nextWeekEstimateKg = weekly ? weekly.recKgNextWeek : toKg(monthlyNextWeekEstimateQty);

    const recQtyNextMonth = weekly ? weekly.recUnitsNextMonth ?? Math.round(weekly.recKgNextMonth) : monthlyRecQtyNextMonth;
    const recKgNextMonth = weekly ? weekly.recKgNextMonth : toKg(monthlyRecQtyNextMonth);

    products.push({
      name,
      sku: skuFor,
      plu: weekly?.plu ?? null,
      category,
      channel,
      marketName,
      weightG,
      series: weekly?.series ?? [],
      dataSource,
      twoMonthsAgoQty,
      twoMonthsAgoKg: toKg(twoMonthsAgoQty),
      twoMonthsAgoLabel: monthsAvailable[currentIdx - 2]?.label ?? "—",
      lastMonthQty,
      lastMonthKg: toKg(lastMonthQty),
      lastMonthLabel: monthsAvailable[currentIdx - 1]?.label ?? "—",
      thisMonthQty,
      thisMonthKg: toKg(thisMonthQty),
      thisMonthLabel: currentMonth ? `${currentMonth.label}${currentMonth.isPartial ? " (to date)" : ""}` : "—",
      growthPct,
      thisWeekExampleQty,
      thisWeekExampleKg,
      thisWeekIsReal,
      nextWeekEstimateQty,
      nextWeekEstimateKg,
      recQtyNextMonth,
      recKgNextMonth,
      weeksOfHistory: weekly?.weeksOfHistory ?? 0,
      monthsOfHistory: monthlyRows?.length ?? 0,
      status,
    });
  }

  return {
    products: products.sort((a, b) => b.lastMonthQty - a.lastMonthQty),
    monthsAvailable,
    dataWarning,
  };
}
