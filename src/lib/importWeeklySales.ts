import { prisma } from "./db";
import { readWeeklySalesFile, WeeklySalesRow } from "./dataSource/weeklySource";

export interface WeeklyImportResult {
  status: "success" | "failed";
  rowCount: number;
  weeksImported: string[];
  message?: string;
}

const DEFAULT_SOURCE_REF = process.env.WEEKLY_SOURCE_REF || "./data/weekly-sales.xlsx";

/**
 * Safe to re-run -- each week's rows are fully replaced, not appended.
 *
 * `sourceRef` overrides the default env-configured source -- used by the
 * upload flow (a temp path for the file someone just uploaded) and will
 * also work with a live URL once one exists, since readWeeklySalesFile
 * fetches http(s) refs the same way it reads local paths.
 */
export async function importWeeklySales(sourceRef: string = DEFAULT_SOURCE_REF): Promise<WeeklyImportResult> {
  let rows: WeeklySalesRow[];
  try {
    rows = await readWeeklySalesFile(sourceRef);
  } catch (err: any) {
    await prisma.importLog.create({
      data: { sourceType: "weekly_xlsx", sourceRef, rowCount: 0, status: "failed", message: err.message },
    });
    return { status: "failed", rowCount: 0, weeksImported: [], message: err.message };
  }

  const weeks = Array.from(new Set(rows.map((r) => r.weekStart)));
  for (const weekStart of weeks) {
    await prisma.weeklySales.deleteMany({ where: { weekStart } });
  }

  for (const row of rows) {
    await prisma.weeklySales.upsert({
      where: {
        weekStart_plu_channel: { weekStart: row.weekStart, plu: row.plu, channel: row.channel },
      },
      create: {
        weekStart: row.weekStart,
        weekLabel: row.weekLabel,
        plu: row.plu,
        productName: row.productName,
        channel: row.channel,
        marketName: row.marketName,
        weightKg: row.weightKg,
        units: row.units,
        revenue: row.revenue,
      },
      update: {
        weekLabel: row.weekLabel,
        productName: row.productName,
        marketName: row.marketName,
        weightKg: row.weightKg,
        units: row.units,
        revenue: row.revenue,
      },
    });
  }

  await prisma.importLog.create({
    data: { sourceType: "weekly_xlsx", sourceRef, rowCount: rows.length, status: "success" },
  });

  return { status: "success", rowCount: rows.length, weeksImported: weeks.sort() };
}