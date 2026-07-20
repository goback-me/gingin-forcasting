import * as XLSX from "xlsx";
import fs from "fs";

export interface WeeklySalesRow {
  weekStart: string; // ISO date, Monday of that week
  weekLabel: string;
  plu: string;
  productName: string;
  weightKg: number;
  units: number;
  revenue: number | null;
}

const WEEK_KEY_RE = /^(\d{4})-(\d{1,2})$/;
const PLU_RE = /^(\d+)\s*-\s*(.+)$/;

const HEADER_ALIASES: Record<string, string[]> = {
  weekKey: ["YearWeek: WeekNumber", "YearWeek", "Week"],
  product: ["PLU_Rollup_Desc", "Product", "Product Name"],
  weightKg: ["Total Wgt", "Weight", "Total Weight"],
  units: ["Total Units", "Units", "Quantity"],
  revenue: ["Total Sales", "Sales", "Revenue"],
};

function resolveHeaders(sourceHeaders: string[]): Record<string, string | undefined> {
  const norm = (h: string) => h.trim().toLowerCase();
  const normalizedSource = sourceHeaders.map((h) => ({ raw: h, norm: norm(h) }));
  const resolved: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = normalizedSource.find((s) => aliases.some((a) => norm(a) === s.norm));
    resolved[field] = match?.raw;
  }
  if (!resolved.weekKey || !resolved.product || !resolved.weightKg || !resolved.units) {
    throw new Error(
      `Weekly sales sheet is missing a required column. Found headers: ${sourceHeaders.join(", ")}`
    );
  }
  return resolved;
}

/** Monday of ISO week `week` in `year`, per the ISO 8601 week-date standard. */
function isoWeekToMonday(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const target = new Date(week1Monday);
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return target.toISOString().slice(0, 10);
}

/**
 * Parses a "YearWeek: WeekNumber" style weekly export. Real structure,
 * confirmed against the actual file:
 *  - every product row already carries its own week value (no forward-fill needed)
 *  - each week has a "Total" subtotal row (PLU_Rollup_Desc === "Total") -- skipped
 *  - the very end of the sheet has a grand-total row (week value literally "Total")
 *    followed by a blank row and a footer describing the applied filters -- both skipped
 *  - product rows are formatted "PLU - Product Name", e.g. "21 - GRASS FED BEEF MINCE..."
 */
export function readWeeklySalesFile(filePath: string): WeeklySalesRow[] {
  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (rows.length === 0) return [];

  const headerMap = resolveHeaders(Object.keys(rows[0]));
  const get = (row: Record<string, any>, field: string) => {
    const header = headerMap[field];
    return header ? row[header] : undefined;
  };

  const out: WeeklySalesRow[] = [];

  for (const row of rows) {
    const weekKeyRaw = String(get(row, "weekKey") ?? "").trim();
    const match = weekKeyRaw.match(WEEK_KEY_RE);
    if (!match) continue; // skips the grand-total "Total" row, blank row, and filter-description footer

    const productRaw = String(get(row, "product") ?? "").trim();
    if (!productRaw || productRaw.toLowerCase() === "total") continue; // skip per-week subtotal rows

    const pluMatch = productRaw.match(PLU_RE);
    if (!pluMatch) continue;

    const weightKg = Number(get(row, "weightKg"));
    const units = Number(get(row, "units"));
    if (!Number.isFinite(weightKg) || !Number.isFinite(units)) continue;

    const [, yearStr, weekStr] = match;
    const year = Number(yearStr);
    const week = Number(weekStr);

    out.push({
      weekStart: isoWeekToMonday(year, week),
      weekLabel: `Week ${week}, ${year}`,
      plu: pluMatch[1],
      productName: pluMatch[2].trim(),
      weightKg,
      units,
      revenue: numOrNull(get(row, "revenue")),
    });
  }

  return out;
}

function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : null;
}
