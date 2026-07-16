import { prisma } from "./db";
import { getNextLockInfo } from "./lockSchedule";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MS_PER_DAY = 86400000;

export interface WeekPoint {
  week: string;
  qty: number;
  kg: number | null;
}

export interface DayPoint {
  date: string;
  dayName: string;
  qty: number;
  kg: number | null;
}

export interface ProductForecast {
  name: string;
  sku: string | null;
  category: string;
  weightG: number | null;
  totalOrders: number;
  series: WeekPoint[];

  // Calendar-month totals -- these are the exact three figures the original
  // brief asked for: "2nd month total qty, last month total qty, Current MTD qty"
  twoMonthsAgoQty: number;
  twoMonthsAgoKg: number | null;
  twoMonthsAgoLabel: string;
  lastMonthQty: number;
  lastMonthKg: number | null;
  lastMonthLabel: string;
  mtdQty: number;
  mtdKg: number | null;
  mtdLabel: string;

  // Growth: last 60 days of sales vs the 60 days before that -- the trend
  // used to adjust every recommendation below.
  growthPct60: number;

  // "LIVE Recommended SOH each week" from the brief: a rough, unadjusted
  // read of how this week is shaping up. Watch-only, not locked on.
  liveThisWeekQty: number;
  liveThisWeekKg: number | null;

  // "Recommended SOH for following Monday" -- the number that gets locked
  // in on Friday: last 7 days of sales, adjusted by the 60-day trend, plus buffer.
  recQty: number;
  recKg: number | null;
  dailyForecast: DayPoint[];

  recQtyNextMonth: number;
  recKgNextMonth: number | null;

  status: "ok" | "declining" | "high_growth" | "low_data";
}

export interface WeekReadiness {
  daysAvailable: number;
  daysRequired: number;
  ready: boolean;
  asOfDate: string;
}

export interface ScenarioLevers {
  demandPct: number;
  promoPct: number;
  bufferPct: number;
}

const DEFAULT_BUFFER = 0.1;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(d: Date, isCurrent: boolean): string {
  const name = d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  return isCurrent ? `${name} (to date)` : name;
}
function shiftMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}
function mondayOf(d: Date): string {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return isoDate(date);
}
function statusFor(totalOrders: number, growthPct: number): ProductForecast["status"] {
  if (totalOrders < 5) return "low_data";
  if (growthPct <= -15) return "declining";
  if (growthPct >= 40) return "high_growth";
  return "ok";
}
function avg(nums: number[]): number {
  return nums.length ? sum(nums) / nums.length : 0;
}
function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * How many days of the CURRENT week (the one containing the most recent
 * sales data) have data in them. The brief's rule: don't trust Friday's
 * lock number until at least 5 days of that week are in. Anchored on the
 * most recent order date in the data (not the server clock) so a demo
 * dataset that stops in the past still reports sensibly, and once live
 * data is flowing this is equivalent to "today".
 */
function computeWeekReadiness(maxDate: Date): WeekReadiness {
  const isoWeekday = maxDate.getUTCDay() === 0 ? 7 : maxDate.getUTCDay();
  return {
    daysAvailable: isoWeekday,
    daysRequired: 5,
    ready: isoWeekday >= 5,
    asOfDate: isoDate(maxDate),
  };
}

/**
 * This is the one place all the forecasting math lives. Every number here
 * is a plain calculation on real sales history -- there's no hidden model
 * to trust blindly. The four "reportable" numbers are, in the order the
 * brief asked for them:
 *   1. Calendar month totals (2 months ago / last month / this month to date)
 *   2. 60-day growth trend
 *   3. Live this-week estimate (unlocked, watch-only)
 *   4. Recommended SOH for the coming Monday (the number that gets locked Friday)
 */
export async function computeForecast(
  levers?: Partial<ScenarioLevers>
): Promise<{ products: ProductForecast[]; weekReadiness: WeekReadiness }> {
  const items = await prisma.orderItem.findMany({ include: { order: true } });

  const buffer = levers?.bufferPct !== undefined ? levers.bufferPct / 100 : DEFAULT_BUFFER;
  const demandMult = 1 + (levers?.demandPct ?? 0) / 100;
  const promoMult = 1 + (levers?.promoPct ?? 0) / 100;
  const weekStart = getNextLockInfo().weekStart;

  const maxDate = items.length
    ? new Date(Math.max(...items.map((i: any) => i.order.orderDate.getTime())))
    : new Date();
  const weekReadiness = computeWeekReadiness(maxDate);

  const twoMonthsAgoDate = shiftMonths(maxDate, -2);
  const lastMonthDate = shiftMonths(maxDate, -1);
  const twoMonthsAgoKey = monthKey(twoMonthsAgoDate);
  const lastMonthKey = monthKey(lastMonthDate);
  const currentMonthKey = monthKey(maxDate);

  const last7Start = new Date(maxDate.getTime() - 6 * MS_PER_DAY);
  const last60Start = new Date(maxDate.getTime() - 59 * MS_PER_DAY);
  const prev60Start = new Date(maxDate.getTime() - 119 * MS_PER_DAY);
  const prev60End = new Date(maxDate.getTime() - 60 * MS_PER_DAY);
  const thisWeekMonday = new Date(mondayOf(maxDate) + "T00:00:00Z");
  const daysElapsedThisWeek = Math.round((maxDate.getTime() - thisWeekMonday.getTime()) / MS_PER_DAY) + 1;

  type Bucket = {
    sku: string | null;
    category: string;
    weightG: number | null;
    totalOrders: number;
    weeks: Map<string, number>;
    weekdayTotals: number[];
    dailyTotals: Map<string, number>;
    monthlyTotals: Map<string, number>;
  };
  const byProduct = new Map<string, Bucket>();

  for (const item of items) {
    const key = item.productName;
    if (!byProduct.has(key)) {
      byProduct.set(key, {
        sku: item.sku,
        category: item.category ?? "Uncategorised",
        weightG: item.weightG,
        totalOrders: 0,
        weeks: new Map(),
        weekdayTotals: [0, 0, 0, 0, 0, 0, 0],
        dailyTotals: new Map(),
        monthlyTotals: new Map(),
      });
    }
    const bucket = byProduct.get(key)!;
    bucket.totalOrders += 1;
    const d = item.order.orderDate;
    const week = mondayOf(d);
    bucket.weeks.set(week, (bucket.weeks.get(week) ?? 0) + item.quantity);
    bucket.weekdayTotals[d.getUTCDay()] += item.quantity;
    const dayKey = isoDate(d);
    bucket.dailyTotals.set(dayKey, (bucket.dailyTotals.get(dayKey) ?? 0) + item.quantity);
    const mKey = monthKey(d);
    bucket.monthlyTotals.set(mKey, (bucket.monthlyTotals.get(mKey) ?? 0) + item.quantity);
    if (item.weightG) bucket.weightG = item.weightG;
    if (item.category) bucket.category = item.category;
    if (item.sku) bucket.sku = item.sku;
  }

  const allWeeks = Array.from(
    new Set(Array.from(byProduct.values()).flatMap((b) => Array.from(b.weeks.keys())))
  ).sort();

  function sumRange(daily: Map<string, number>, start: Date, end: Date): number {
    let total = 0;
    for (const [dateStr, qty] of daily) {
      const t = new Date(dateStr + "T00:00:00Z").getTime();
      if (t >= start.getTime() && t <= end.getTime()) total += qty;
    }
    return total;
  }

  const results: ProductForecast[] = [];

  for (const [name, bucket] of byProduct) {
    const series: WeekPoint[] = allWeeks.map((week) => {
      const qty = bucket.weeks.get(week) ?? 0;
      const kg = bucket.weightG ? round1((qty * bucket.weightG) / 1000) : null;
      return { week, qty, kg };
    });

    const toKg = (qty: number) => (bucket.weightG ? round1((qty * bucket.weightG) / 1000) : null);

    const twoMonthsAgoQty = bucket.monthlyTotals.get(twoMonthsAgoKey) ?? 0;
    const lastMonthQty = bucket.monthlyTotals.get(lastMonthKey) ?? 0;
    const mtdQty = bucket.monthlyTotals.get(currentMonthKey) ?? 0;

    const last7 = sumRange(bucket.dailyTotals, last7Start, maxDate);
    const last60 = sumRange(bucket.dailyTotals, last60Start, maxDate);
    const prev60 = sumRange(bucket.dailyTotals, prev60Start, prev60End);
    const growthPct60 = prev60 > 0 ? round1((last60 / prev60 - 1) * 100) : 0;
    const growthFactor = 1 + growthPct60 / 100;

    const partialThisWeek = sumRange(bucket.dailyTotals, thisWeekMonday, maxDate);
    const liveThisWeekQty = Math.round((partialThisWeek / Math.max(daysElapsedThisWeek, 1)) * 7);

    const scenarioAdjusted = last7 * growthFactor * demandMult * promoMult * (1 + buffer);
    const recQty = Math.round(scenarioAdjusted);
    const recQtyNextMonth = Math.round(scenarioAdjusted * 4.33);

    const dailyForecast = splitAcrossWeek(recQty, bucket.weightG, bucket.weekdayTotals, weekStart);

    results.push({
      name,
      sku: bucket.sku,
      category: bucket.category,
      weightG: bucket.weightG,
      totalOrders: bucket.totalOrders,
      series,
      twoMonthsAgoQty,
      twoMonthsAgoKg: toKg(twoMonthsAgoQty),
      twoMonthsAgoLabel: monthLabel(twoMonthsAgoDate, false),
      lastMonthQty,
      lastMonthKg: toKg(lastMonthQty),
      lastMonthLabel: monthLabel(lastMonthDate, false),
      mtdQty,
      mtdKg: toKg(mtdQty),
      mtdLabel: monthLabel(maxDate, true),
      growthPct60,
      liveThisWeekQty,
      liveThisWeekKg: toKg(liveThisWeekQty),
      recQty,
      recKg: toKg(recQty),
      dailyForecast,
      recQtyNextMonth,
      recKgNextMonth: toKg(recQtyNextMonth),
      status: statusFor(bucket.totalOrders, growthPct60),
    });
  }

  return { products: results.sort((a, b) => b.totalOrders - a.totalOrders), weekReadiness };
}

/**
 * Splits a product's next-week total across its 7 days using the
 * historical share of sales each weekday has carried. Falls back to an
 * even 1/7 split when there isn't enough history to trust a pattern yet.
 */
function splitAcrossWeek(
  recQty: number,
  weightG: number | null,
  weekdayTotals: number[],
  weekStartIso: string
): DayPoint[] {
  const totalHistory = sum(weekdayTotals);
  const shares =
    totalHistory > 0 ? weekdayTotals.map((t) => t / totalHistory) : weekdayTotals.map(() => 1 / 7);

  const start = new Date(weekStartIso + "T00:00:00Z");
  const days: DayPoint[] = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + i);
    const dow = date.getUTCDay();
    const qty = Math.round(recQty * shares[dow]);
    const kg = weightG ? round1((qty * weightG) / 1000) : null;
    days.push({ date: isoDate(date), dayName: DAY_NAMES[dow], qty, kg });
  }
  return days;
}
