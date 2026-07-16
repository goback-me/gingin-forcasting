import * as XLSX from "xlsx";
import fs from "fs";
import { OrderSource, RawOrderRow } from "./types";
import { resolveHeaders } from "./headerAliases";

/**
 * Reads tabular order data from either:
 *  - a local file path (.xlsx or .csv) -- what we use today
 *  - a URL that returns CSV -- what a Google Sheet's "File > Share > Publish
 *    to web > CSV" link returns. Same parsing code either way, because a
 *    published Google Sheet and a downloaded export are both just rows and
 *    columns. To move to live Google Sheets later: set
 *    SOURCE_TYPE=csv_url and SOURCE_URL=<published sheet link> in .env,
 *    nothing else in the app needs to change.
 */
export class TabularOrderSource implements OrderSource {
  sourceType: string;
  sourceRef: string;

  constructor(ref: string) {
    this.sourceRef = ref;
    this.sourceType = ref.startsWith("http") ? "csv_url" : "csv_file";
  }

  async fetchRows(): Promise<RawOrderRow[]> {
    const workbook = await this.loadWorkbook();
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (rows.length === 0) return [];

    const headerMap = resolveHeaders(Object.keys(rows[0]));

    const get = (row: Record<string, any>, field: string) => {
      const header = headerMap[field];
      return header ? row[header] : undefined;
    };

    return rows
      .map((row): RawOrderRow | null => {
        const productName = String(get(row, "productName") ?? "").trim();
        if (!productName) return null;

        const qtyRaw = get(row, "quantity");
        const quantity = Number(qtyRaw);
        if (!Number.isFinite(quantity)) return null;

        const dateRaw = get(row, "orderDate");
        const orderDate = normalizeDate(dateRaw);
        if (!orderDate) return null;

        return {
          orderId: String(get(row, "orderId") ?? ""),
          orderDate,
          status: str(get(row, "status")),
          channel: str(get(row, "channel")),
          productName,
          sku: str(get(row, "sku")),
          category: cleanCategory(get(row, "category")),
          quantity,
          weightG: numOrUndef(get(row, "weightG")),
          itemCost: numOrUndef(get(row, "itemCost")),
        };
      })
      .filter((r): r is RawOrderRow => r !== null);
  }

  private async loadWorkbook(): Promise<XLSX.WorkBook> {
    if (this.sourceRef.startsWith("http")) {
      const res = await fetch(this.sourceRef);
      if (!res.ok) throw new Error(`Failed to fetch source (${res.status}): ${this.sourceRef}`);
      const buf = await res.arrayBuffer();
      return XLSX.read(buf, { type: "buffer" });
    }
    const buf = fs.readFileSync(this.sourceRef);
    return XLSX.read(buf, { type: "buffer" });
  }
}

function str(v: any): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v).trim();
}

/**
 * Source exports (WooCommerce especially) dump every category tag ever
 * applied to a product into one comma-separated field, HTML-entity-encoded
 * ("Mince &amp; Diced,Mince &amp; Diced,Beef,meat,Not for postage"). That's
 * useless as a dashboard column, so we decode entities and keep only the
 * first tag as the product's primary category.
 */
function cleanCategory(v: any): string | undefined {
  const raw = str(v);
  if (!raw) return undefined;
  const decoded = raw.replace(/&amp;/gi, "&").replace(/&#038;/g, "&");
  const first = decoded.split(",")[0]?.trim();
  return first || undefined;
}

function numOrUndef(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && v !== "" ? n : undefined;
}

/** Accepts "2026-05-12", Excel date serials, or JS Date objects from xlsx parsing. */
function normalizeDate(raw: any): string | null {
  if (!raw && raw !== 0) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === "number") {
    const parsed = XLSX.SSF.parse_date_code(raw);
    if (!parsed) return null;
    const d = new Date(parsed.y, parsed.m - 1, parsed.d);
    return d.toISOString().slice(0, 10);
  }
  const asDate = new Date(raw);
  if (!isNaN(asDate.getTime())) return asDate.toISOString().slice(0, 10);
  return null;
}
