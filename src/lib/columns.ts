import { prisma } from "./db";

export const DEFAULT_COLUMNS = [
  { key: "name", label: "Product", type: "text", sortOrder: 0 },
  { key: "category", label: "Category", type: "text", sortOrder: 1 },
  { key: "channel", label: "Channel", type: "badge", sortOrder: 2 },
  { key: "marketName", label: "Market", type: "text", sortOrder: 3 },
  { key: "twoMonthsAgoKg", label: "2 months ago", type: "kg", sortOrder: 4 },
  { key: "lastMonthKg", label: "Last month", type: "kg", sortOrder: 5 },
  { key: "thisMonthKg", label: "This month (so far)", type: "kg", sortOrder: 6 },
  { key: "growthPct", label: "Growth", type: "percent", sortOrder: 7 },
  { key: "thisWeekExampleKg", label: "This week", type: "kg", sortOrder: 8 },
  { key: "nextWeekEstimateKg", label: "Next week", type: "kg", sortOrder: 9 },
  { key: "recKgNextMonth", label: "Recommended for next month", type: "kg", sortOrder: 10 },
  { key: "status", label: "Status", type: "badge", sortOrder: 11 },
];

const DEPRECATED_KEYS = [
  "recQty", "avgPrev4", "avgLast4", "growthPct60",
  "recKg", "liveThisWeekKg", "mtdKg", "mtdLabel",
];

/** Ensures every default column exists; never overwrites a column a user
 *  has already customised (visibility/order), so this is safe to call on
 *  every boot. */
export async function ensureDefaultColumns() {
  for (const col of DEFAULT_COLUMNS) {
    await prisma.dashboardColumn.upsert({
      where: { key: col.key },
      update: { label: col.label, type: col.type, sortOrder: col.sortOrder },
      create: { ...col, visible: true },
    });
  }
  for (const key of DEPRECATED_KEYS) {
    await prisma.dashboardColumn.updateMany({ where: { key }, data: { visible: false } });
  }
}

export async function getVisibleColumns() {
  await ensureDefaultColumns();
  return prisma.dashboardColumn.findMany({
    where: { visible: true },
    orderBy: { sortOrder: "asc" },
  });
}
