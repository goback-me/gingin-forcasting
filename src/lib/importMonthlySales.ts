import { prisma } from "./db";
import { readMonthlySalesFile, MonthlySalesRow } from "./dataSource/monthlySource";

export interface MonthlyImportResult {
  status: "success" | "failed";
  rowCount: number;
  monthsImported: string[];
  message?: string;
}

const SOURCE_REF = process.env.MONTHLY_SOURCE_REF || "./data/quarter-sales.xls";

/**
 * Imports a monthly sales report (one sheet per month) into MonthlySales.
 * Safe to re-run -- each month's rows are fully replaced, not appended, so
 * re-importing an updated file just overwrites the numbers for whichever
 * months are in it.
 */
export async function importMonthlySales(): Promise<MonthlyImportResult> {
  let rows: MonthlySalesRow[];
  try {
    rows = readMonthlySalesFile(SOURCE_REF);
  } catch (err: any) {
    await prisma.importLog.create({
      data: { sourceType: "monthly_xls", sourceRef: SOURCE_REF, rowCount: 0, status: "failed", message: err.message },
    });
    return { status: "failed", rowCount: 0, monthsImported: [], message: err.message };
  }

  const months = Array.from(new Set(rows.map((r) => r.month)));
  for (const month of months) {
    await prisma.monthlySales.deleteMany({ where: { month } });
  }

  for (const row of rows) {
    await prisma.monthlySales.upsert({
      where: { month_productName: { month: row.month, productName: row.productName } },
      create: {
        month: row.month,
        monthLabel: row.monthLabel,
        isPartial: row.isPartial,
        productName: row.productName,
        sku: row.sku,
        itemsSold: row.itemsSold,
        revenue: row.revenue,
        orders: row.orders,
        variations: row.variations,
      },
      update: {
        monthLabel: row.monthLabel,
        isPartial: row.isPartial,
        sku: row.sku,
        itemsSold: row.itemsSold,
        revenue: row.revenue,
        orders: row.orders,
        variations: row.variations,
      },
    });
  }

  await prisma.importLog.create({
    data: { sourceType: "monthly_xls", sourceRef: SOURCE_REF, rowCount: rows.length, status: "success" },
  });

  return { status: "success", rowCount: rows.length, monthsImported: months };
}
