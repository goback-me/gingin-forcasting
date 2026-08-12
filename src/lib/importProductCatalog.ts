import { prisma } from "./db";
import { readProductCatalogFile, CatalogRow } from "./dataSource/catalogSource";

export interface CatalogImportResult {
  status: "success" | "failed";
  rowCount: number;
  message?: string;
}

const DEFAULT_SOURCE_REF = process.env.CATALOG_SOURCE_REF || "./data/product-catalog.xlsx";

/**
 * Imports the product master catalog (one row per product code/variant --
 * NOT sales data, so it never touches WeeklySales/MonthlySales/OrderItem).
 * Purely a category/subCategory enrichment source, matched by product name
 * against sales data inside monthlyForecast.ts.
 *
 * Safe to re-run -- upserts by productCode, so re-importing an updated
 * export just overwrites each row's fields rather than duplicating them.
 *
 * `sourceRef` overrides the default env-configured source -- used by the
 * upload flow, and works with a live URL too (a Google Sheets link etc.)
 * since readProductCatalogFile fetches http(s) refs the same way it reads
 * local paths.
 */
export async function importProductCatalog(sourceRef: string = DEFAULT_SOURCE_REF): Promise<CatalogImportResult> {
  let rows: CatalogRow[];
  try {
    rows = await readProductCatalogFile(sourceRef);
  } catch (err: any) {
    await prisma.importLog.create({
      data: { sourceType: "product_catalog", sourceRef, rowCount: 0, status: "failed", message: err.message },
    });
    return { status: "failed", rowCount: 0, message: err.message };
  }

  for (const row of rows) {
    await prisma.productCatalog.upsert({
      where: { productCode: row.productCode },
      create: row,
      update: {
        parentCode: row.parentCode,
        description: row.description,
        generalStatement: row.generalStatement,
        category: row.category,
        subCategory: row.subCategory,
        productLocation: row.productLocation,
      },
    });
  }

  await prisma.importLog.create({
    data: { sourceType: "product_catalog", sourceRef, rowCount: rows.length, status: "success" },
  });

  return { status: "success", rowCount: rows.length };
}