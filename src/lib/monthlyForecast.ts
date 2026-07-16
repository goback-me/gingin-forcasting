import { prisma } from "./db";

type MonthlyRow = {
  month: string;
  monthLabel: string;
  isPartial: boolean;
  productName: string;
  sku: string | null;
  itemsSold: number;
};

export interface MonthlyProductForecast {
  name: string;
  sku: string | null;
  category: string;
  weightG: number | null;

  twoMonthsAgoQty: number;
  twoMonthsAgoKg: number | null;
  twoMonthsAgoLabel: string;

  lastMonthQty: number;
  lastMonthKg: number | null;
  lastMonthLabel: string;

  thisMonthQty: number; // partial -- "to date"
  thisMonthKg: number | null;
  thisMonthLabel: string;

  growthPct: number; // last full month vs the one before it

  // Explicitly an assumption, not measured -- there's no daily/weekly data
  // in this source. Derived as last month's total spread evenly across
  // ~4.33 weeks. Labelled as an example everywhere it's shown.
  thisWeekExampleQty: number;
  thisWeekExampleKg: number | null;

  recQtyNextMonth: number;
  recKgNextMonth: number | null;

  status: "ok" | "declining" | "high_growth" | "low_data";
}

export interface MonthlyForecastResult {
  products: MonthlyProductForecast[];
  monthsAvailable: { month: string; label: string; isPartial: boolean }[];
  dataWarning: string | null; // e.g. flags a suspiciously duplicated month
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

  // The "current" month is whichever one is flagged partial; if none is,
  // fall back to the most recent month present.
  const currentMonth = monthsAvailable.find((m) => m.isPartial) ?? monthsAvailable[monthsAvailable.length - 1];
  const currentIdx = monthKeys.indexOf(currentMonth?.month ?? "");
  const lastMonthKey = currentIdx > 0 ? monthKeys[currentIdx - 1] : null;
  const twoMonthsAgoKey = currentIdx > 1 ? monthKeys[currentIdx - 2] : null;

  // Data-quality guard: if two consecutive months are identical across the
  // board, the export almost certainly wasn't refreshed.
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

  const byProduct = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byProduct.get(row.productName) ?? [];
    list.push(row);
    byProduct.set(row.productName, list);
  }

  const products: MonthlyProductForecast[] = [];

  for (const [name, productRows] of byProduct) {
    const qtyFor = (month: string | null) => (month ? productRows.find((r) => r.month === month)?.itemsSold ?? 0 : 0);
    const skuFor = productRows.find((r) => r.sku)?.sku ?? null;

    // Enrich from real per-order-line data if this product also appears
    // there (from an earlier orders import) -- that's the only place
    // weight and category actually live, since the monthly report has
    // neither.
    const enrichment = await prisma.orderItem.findFirst({
      where: { productName: name },
      select: { weightG: true, category: true },
      orderBy: { id: "desc" },
    });
    const weightG = enrichment?.weightG ?? null;
    const category = enrichment?.category ?? "Uncategorised";

    const twoMonthsAgoQty = qtyFor(twoMonthsAgoKey);
    const lastMonthQty = qtyFor(lastMonthKey);
    const thisMonthQty = qtyFor(currentMonth?.month ?? null);

    const toKg = (qty: number) => (weightG ? round1((qty * weightG) / 1000) : null);

    const growthPct = twoMonthsAgoQty > 0 ? round1((lastMonthQty / twoMonthsAgoQty - 1) * 100) : 0;
    const growthFactor = 1 + growthPct / 100;

    const thisWeekExampleQty = Math.round(lastMonthQty / 4.33);

    const scenarioAdjusted = lastMonthQty * growthFactor * demandMult * promoMult * (1 + buffer);
    const recQtyNextMonth = Math.round(scenarioAdjusted);

    products.push({
      name,
      sku: skuFor,
      category,
      weightG,
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
      thisWeekExampleKg: toKg(thisWeekExampleQty),
      recQtyNextMonth,
      recKgNextMonth: toKg(recQtyNextMonth),
      status: statusFor(productRows.length, growthPct),
    });
  }

  return {
    products: products.sort((a, b) => b.lastMonthQty - a.lastMonthQty),
    monthsAvailable,
    dataWarning,
  };
}
