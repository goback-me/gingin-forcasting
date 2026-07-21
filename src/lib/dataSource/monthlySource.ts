import * as XLSX from "xlsx";
import fs from "fs";
import { classifyChannel, Channel } from "../channel";
import { assignDummyMarket } from "../dummyMarket";

export interface MonthlySalesRow {
  month: string; // "YYYY-MM"
  monthLabel: string; // "April 2026"
  isPartial: boolean;
  productName: string;
  sku: string | null;
  channel: Channel;
  marketName: string | null;
  itemsSold: number;
  revenue: number | null;
  orders: number | null;
  variations: number | null;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const HEADER_ALIASES: Record<string, string[]> = {
  productName: ["Product title", "Product Name", "product_name", "Product"],
  sku: ["SKU", "sku"],
  itemsSold: ["Items sold", "items_sold", "Quantity", "Qty"],
  revenue: ["N. Revenue", "Net Revenue", "Revenue", "revenue"],
  orders: ["Orders", "orders"],
  variations: ["Variations", "variations"],
  // Optional -- this source has never had one, everything defaults to Market.
  channel: ["Channel", "Sale Channel", "Source", "Order Type", "Market/Online"],
};

function resolveHeaders(sourceHeaders: string[]): Record<string, string | undefined> {
  const norm = (h: string) => h.trim().toLowerCase();
  const normalizedSource = sourceHeaders.map((h) => ({ raw: h, norm: norm(h) }));
  const resolved: Record<string, string | undefined> = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = normalizedSource.find((s) => aliases.some((a) => norm(a) === s.norm));
    resolved[field] = match?.raw;
  }
  if (!resolved.productName || !resolved.itemsSold) {
    throw new Error(
      `Monthly sales sheet is missing a required column (need a product name and an items-sold count). Found headers: ${sourceHeaders.join(", ")}`
    );
  }
  return resolved;
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * Parses a sheet name like "April 1_30" or "July 1_16" into a month key,
 * a display label, and whether the range covers the whole month (a
 * shorter range, like "1_16" in a 31-day month, means this is the current
 * month reported so far).
 *
 * The sheet name has no year, so this assumes the year is `assumedYear`
 * (defaults to the current year) -- override via the `year` option if a
 * report from a different year ever comes in.
 */
function parseSheetName(name: string, assumedYear: number): { month: string; monthLabel: string; isPartial: boolean } | null {
  const match = name.trim().match(/^([A-Za-z]+)\s+(\d+)_(\d+)$/);
  if (!match) return null;
  const [, monthName, , endDayStr] = match;
  const monthIndex0 = MONTH_NAMES.indexOf(monthName.toLowerCase());
  if (monthIndex0 === -1) return null;
  const endDay = Number(endDayStr);
  const isPartial = endDay < daysInMonth(assumedYear, monthIndex0);
  const month = `${assumedYear}-${String(monthIndex0 + 1).padStart(2, "0")}`;
  const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1).toLowerCase()} ${assumedYear}`;
  return { month, monthLabel, isPartial };
}

export function readMonthlySalesFile(filePath: string, assumedYear: number = new Date().getFullYear()): MonthlySalesRow[] {
  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: "buffer" });

  const rows: MonthlySalesRow[] = [];

  for (const sheetName of workbook.SheetNames) {
    const parsed = parseSheetName(sheetName, assumedYear);
    if (!parsed) continue; // skip sheets that don't match the "Month 1_30" naming pattern

    const sheet = workbook.Sheets[sheetName];
    const sheetRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    if (sheetRows.length === 0) continue;

    const headerMap = resolveHeaders(Object.keys(sheetRows[0]));
    const get = (row: Record<string, any>, field: string) => {
      const header = headerMap[field];
      return header ? row[header] : undefined;
    };

    for (const row of sheetRows) {
      const productName = String(get(row, "productName") ?? "").trim();
      if (!productName) continue;
      const itemsSold = Number(get(row, "itemsSold"));
      if (!Number.isFinite(itemsSold)) continue;

      const channel = classifyChannel(get(row, "channel"));
      const marketName = channel === "Market" ? assignDummyMarket(productName) : null;

      rows.push({
        month: parsed.month,
        monthLabel: parsed.monthLabel,
        isPartial: parsed.isPartial,
        productName,
        sku: strOrNull(get(row, "sku")),
        channel,
        marketName,
        itemsSold,
        revenue: numOrNull(get(row, "revenue")),
        orders: numOrNull(get(row, "orders")),
        variations: numOrNull(get(row, "variations")),
      });
    }
  }

  return rows;
}

function strOrNull(v: any): string | null {
  if (v === undefined || v === null || v === "") return null;
  return String(v).trim();
}
function numOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : null;
}
