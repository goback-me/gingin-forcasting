import { prisma } from "./db";
import { readWeeklySalesFile, WeeklySalesRow } from "./dataSource/weeklySource";

export interface WeeklyImportResult {
  status: "success" | "failed";
  rowCount: number;
  weeksImported: string[];
  message?: string;
}

const SOURCE_REF = process.env.WEEKLY_SOURCE_REF || "./data/weekly-sales.xlsx";

/** Safe to re-run -- each week's rows are fully replaced, not appended. */
export async function importWeeklySales(): Promise<WeeklyImportResult> {
  let rows: WeeklySalesRow[];
  try {
    rows = readWeeklySalesFile(SOURCE_REF);
  } catch (err: any) {
    await prisma.importLog.create({
      data: { sourceType: "weekly_xlsx", sourceRef: SOURCE_REF, rowCount: 0, status: "failed", message: err.message },
    });
    return { status: "failed", rowCount: 0, weeksImported: [], message: err.message };
  }

  const weeks = Array.from(new Set(rows.map((r) => r.weekStart)));
  for (const weekStart of weeks) {
    await prisma.weeklySales.deleteMany({ where: { weekStart } });
  }

  for (const row of rows) {
    await prisma.weeklySales.upsert({
      where: { weekStart_plu: { weekStart: row.weekStart, plu: row.plu } },
      create: {
        weekStart: row.weekStart,
        weekLabel: row.weekLabel,
        plu: row.plu,
        productName: row.productName,
        weightKg: row.weightKg,
        units: row.units,
        revenue: row.revenue,
      },
      update: {
        weekLabel: row.weekLabel,
        productName: row.productName,
        weightKg: row.weightKg,
        units: row.units,
        revenue: row.revenue,
      },
    });
  }

  await prisma.importLog.create({
    data: { sourceType: "weekly_xlsx", sourceRef: SOURCE_REF, rowCount: rows.length, status: "success" },
  });

  return { status: "success", rowCount: rows.length, weeksImported: weeks.sort() };
}
