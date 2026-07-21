import { prisma } from "./db";

export interface WeekPoint {
  weekStart: string;
  weekLabel: string;
  units: number;
  kg: number;
}

export interface WeeklyProductForecast {
  name: string;
  plu: string;
  category: string;
  channel: "Market" | "Online"; // which sales channel this row's numbers come from
  series: WeekPoint[]; // every week this product has data for, in order

  lastWeekKg: number;
  lastWeekUnits: number;
  lastWeekLabel: string;
  priorWeekKg: number;
  priorWeekUnits: number;
  priorWeekLabel: string;

  // Trailing 4-week average vs the 4 weeks before that -- smooths out
  // single-week noise, same model the original weekly engine used, except
  // now backed by real weekly data instead of a monthly approximation.
  avgLast4Kg: number;
  avgLast4Units: number;
  avgPrior4Kg: number | null;
  growthPct: number;

  // How much each unit/pack actually weighs, on average, for THIS
  // product specifically -- derived from its own real sales history, not
  // assumed. This varies a lot between products (a 700g pack vs a 1kg
  // pack vs loose-weight items), which is exactly why it has to be
  // calculated per product rather than using one conversion for everything.
  avgWeightPerUnitKg: number | null;

  recKgNextWeek: number; // real number now, not an "example"/"estimate"
  recUnitsNextWeek: number | null; // the same recommendation, converted to units to prepare
  recKgNextMonth: number;
  recUnitsNextMonth: number | null;

  weeksOfHistory: number;
  status: "ok" | "declining" | "high_growth" | "low_data";
}

export interface WeeklyForecastResult {
  products: WeeklyProductForecast[];
  weeksAvailable: { weekStart: string; weekLabel: string }[];
}

function statusFor(weeksOfHistory: number, growthPct: number): WeeklyProductForecast["status"] {
  if (weeksOfHistory < 4) return "low_data";
  if (growthPct <= -15) return "declining";
  if (growthPct >= 40) return "high_growth";
  return "ok";
}
function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function computeWeeklyForecast(levers?: {
  demandPct?: number;
  promoPct?: number;
  bufferPct?: number;
}): Promise<WeeklyForecastResult> {
  const rows = await prisma.weeklySales.findMany();

  const buffer = levers?.bufferPct !== undefined ? levers.bufferPct / 100 : 0.1;
  const demandMult = 1 + (levers?.demandPct ?? 0) / 100;
  const promoMult = 1 + (levers?.promoPct ?? 0) / 100;

  const weekKeys = Array.from(new Set(rows.map((r: any) => r.weekStart))).sort() as string[];
  const weeksAvailable = weekKeys.map((weekStart) => ({
    weekStart,
    weekLabel: (rows.find((r: any) => r.weekStart === weekStart) as any).weekLabel,
  }));

  const byProduct = new Map<string, any[]>();
  for (const row of rows as any[]) {
    const key = `${row.productName}::${row.channel ?? "Market"}`;
    const list = byProduct.get(key) ?? [];
    list.push(row);
    byProduct.set(key, list);
  }

  const products: WeeklyProductForecast[] = [];

  for (const [, productRows] of byProduct) {
    const name = productRows[0].productName;
    const channel = (productRows[0].channel ?? "Market") as "Market" | "Online";
    const byWeek = new Map(productRows.map((r) => [r.weekStart, r]));
    const series: WeekPoint[] = weekKeys
      .filter((w) => byWeek.has(w))
      .map((w) => {
        const r = byWeek.get(w)!;
        return { weekStart: w, weekLabel: r.weekLabel, units: r.units, kg: r.weightKg };
      });

    const enrichment = await prisma.orderItem.findFirst({
      where: { productName: name },
      select: { category: true },
      orderBy: { id: "desc" },
    });
    const category = (enrichment as any)?.category ?? "Uncategorised";

    const kgSeries = series.map((s) => s.kg);
    const unitsSeries = series.map((s) => s.units);
    const last4Kg = kgSeries.slice(-4);
    const last4Units = unitsSeries.slice(-4);
    const prior4Kg = kgSeries.slice(-8, -4);

    const lastWeek = series[series.length - 1];
    const priorWeek = series[series.length - 2];

    const avgLast4Kg = round1(avg(last4Kg));
    const avgLast4Units = round1(avg(last4Units));
    const avgPrior4Kg = prior4Kg.length ? round1(avg(prior4Kg)) : null;
    const growthPct = avgPrior4Kg && avgPrior4Kg > 0 ? round1((avgLast4Kg / avgPrior4Kg - 1) * 100) : 0;
    const growthFactor = 1 + growthPct / 100;

    // Ratio-of-sums, not average-of-ratios -- more stable than averaging
    // each week's individual kg/units ratio, since a single low-volume
    // week (e.g. 1 unit sold) can otherwise swing that ratio wildly.
    // Prefers the trailing 4 weeks (reflects current pack sizing); falls
    // back to the product's entire history if recent weeks are too thin.
    const sumLast4Units = last4Units.reduce((a, b) => a + b, 0);
    const sumLast4Kg = last4Kg.reduce((a, b) => a + b, 0);
    const sumAllUnits = unitsSeries.reduce((a, b) => a + b, 0);
    const sumAllKg = kgSeries.reduce((a, b) => a + b, 0);
    const avgWeightPerUnitKg =
      sumLast4Units > 0
        ? round3(sumLast4Kg / sumLast4Units)
        : sumAllUnits > 0
        ? round3(sumAllKg / sumAllUnits)
        : null;

    const scenarioAdjusted = avgLast4Kg * growthFactor * demandMult * promoMult * (1 + buffer);
    const recKgNextWeek = round1(scenarioAdjusted);
    const recKgNextMonth = round1(scenarioAdjusted * 4.33);
    const recUnitsNextWeek = avgWeightPerUnitKg ? Math.round(recKgNextWeek / avgWeightPerUnitKg) : null;
    const recUnitsNextMonth = avgWeightPerUnitKg ? Math.round(recKgNextMonth / avgWeightPerUnitKg) : null;

    products.push({
      name,
      plu: productRows[0].plu,
      category,
      channel,
      series,
      lastWeekKg: lastWeek?.kg ?? 0,
      lastWeekUnits: lastWeek?.units ?? 0,
      lastWeekLabel: lastWeek?.weekLabel ?? "—",
      priorWeekKg: priorWeek?.kg ?? 0,
      priorWeekUnits: priorWeek?.units ?? 0,
      priorWeekLabel: priorWeek?.weekLabel ?? "—",
      avgLast4Kg,
      avgLast4Units,
      avgPrior4Kg,
      growthPct,
      avgWeightPerUnitKg,
      recKgNextWeek,
      recUnitsNextWeek,
      recKgNextMonth,
      recUnitsNextMonth,
      weeksOfHistory: series.length,
      status: statusFor(series.length, growthPct),
    });
  }

  return {
    products: products.sort((a, b) => b.lastWeekKg - a.lastWeekKg),
    weeksAvailable,
  };
}