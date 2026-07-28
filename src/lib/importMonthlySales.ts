import { prisma } from "./db";
import { readMonthlySalesFile, MonthlySalesRow } from "./dataSource/monthlySource";

export interface MonthlyImportResult {
  status: "success" | "failed";
  rowCount: number;
  monthsImported: string[];
  message?: string;
}

const DEFAULT_SOURCE_REF = process.env.MONTHLY_SOURCE_REF || "./data/quarter-sales.xls";

/**
 * Imports a monthly sales report (one sheet per month) into MonthlySales.
 * Safe to re-run -- each month's rows are fully replaced, not appended, so
 * re-importing an updated file just overwrites the numbers for whichever
 * months are in it.
 *
 * `sourceRef` overrides the default env-configured source -- used by the
 * upload flow and works with a live URL too.
 */
export async function importMonthlySales(sourceRef: string = DEFAULT_SOURCE_REF): Promise<MonthlyImportResult> {
  let rows: MonthlySalesRow[];
  try {
    rows = await readMonthlySalesFile(sourceRef);
  } catch (err: any) {
    await prisma.importLog.create({
      data: { sourceType: "monthly_xls", sourceRef, rowCount: 0, status: "failed", message: err.message },
    });
    return { status: "failed", rowCount: 0, monthsImported: [], message: err.message };
  }

  const months = Array.from(new Set(rows.map((r) => r.month)));
  for (const month of months) {
    await prisma.monthlySales.deleteMany({ where: { month } });
  }

  for (const row of rows) {
    await prisma.monthlySales.upsert({
      where: {
        month_productName_channel: { month: row.month, productName: row.productName, channel: row.channel },
      },
      create: {
        month: row.month,
        monthLabel: row.monthLabel,
        isPartial: row.isPartial,
        productName: row.productName,
        sku: row.sku,
        channel: row.channel,
        marketName: row.marketName,
        itemsSold: row.itemsSold,
        revenue: row.revenue,
        orders: row.orders,
        variations: row.variations,
      },
      update: {
        monthLabel: row.monthLabel,
        isPartial: row.isPartial,
        sku: row.sku,
        marketName: row.marketName,
        itemsSold: row.itemsSold,
        revenue: row.revenue,
        orders: row.orders,
        variations: row.variations,
      },
    });
  }

  await prisma.importLog.create({
    data: { sourceType: "monthly_xls", sourceRef, rowCount: rows.length, status: "success" },
  });

  return { status: "success", rowCount: rows.length, monthsImported: months };
}