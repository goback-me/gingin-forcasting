import * as XLSX from "xlsx";
import { readSourceBuffer } from "./readSourceBuffer";

export interface CatalogRow {
  productCode: string;
  parentCode: string | null;
  description: string;
  generalStatement: string | null;
  category: string | null;
  subCategory: string | null;
  productLocation: string | null;
}

function str(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Normalizes a product name for matching across sources that spell the
 * same product slightly differently (extra whitespace, case). Used to
 * join this catalog's `description` against sales-data product names.
 */
export function normalizeCatalogName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function readProductCatalogFile(ref: string): Promise<CatalogRow[]> {
  const buf = await readSourceBuffer(ref);
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: null });

  const out: CatalogRow[] = [];
  for (const row of rows) {
    const productCode = str(row["Product Code"]);
    if (!productCode) continue; // skip any blank/artifact rows

    const rawCategory = str(row["CATEGORY"]);
    const productLocation = str(row["Product Location"]);
    const rawSubCategory = str(row["SUB CATEGORY"]);

    out.push({
      productCode,
      parentCode: str(row["Parent Code"]),
      description: str(row["Description"]) ?? productCode,
      generalStatement: str(row["General Statement"]),
      // Client instruction: CATEGORY column wins when it has a value;
      // Product Location is only used as a stand-in when CATEGORY is
      // blank (true for every row seen in the sample export so far).
      category: rawCategory ?? productLocation,
      // SUB CATEGORY gets no fallback -- blank stays blank on purpose.
      subCategory: rawSubCategory,
      productLocation,
    });
  }
  return out;
}