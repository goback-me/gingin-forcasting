import * as XLSX from "xlsx";

export type DetectedFileType = "weekly" | "monthly" | "orders" | "catalog";

function getHeaderRow(buf: Buffer): string[] {
  const workbook = XLSX.read(buf, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // All four known formats put their real header in the first row, but
  // scan a few rows just in case there's a blank leading row or two.
  for (const row of rows.slice(0, 5)) {
    const cells = (row ?? []).filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (cells.length >= 2) return cells.map((c) => String(c).trim());
  }
  return [];
}

function has(headers: string[], needle: string): boolean {
  const n = needle.toLowerCase();
  return headers.some((h) => h.toLowerCase() === n);
}

/**
 * Looks at a file's column headers and guesses which of our four data
 * sources it is, so whoever's uploading doesn't have to know or pick --
 * they just drop the file in. Checked most-distinctive-marker-first so
 * there's no ambiguity between formats.
 */
export function detectFileType(buf: Buffer): DetectedFileType | null {
  const headers = getHeaderRow(buf);
  if (headers.length === 0) return null;

  // Product catalog: "MSA Grade" is unique to this export; Parent Code +
  // Barcode together is a solid backup signal.
  if (has(headers, "MSA Grade") || (has(headers, "Parent Code") && has(headers, "Barcode"))) {
    return "catalog";
  }
  // Weekly Market export: PLU_Rollup_Desc is unique to this format.
  if (has(headers, "PLU_Rollup_Desc") || has(headers, "YearWeek: WeekNumber")) {
    return "weekly";
  }
  // Monthly Online report: this specific column pair is unique to it.
  if (has(headers, "Items sold") && has(headers, "Product title")) {
    return "monthly";
  }
  // Orders: Order ID + Order Date together is the marker.
  if (has(headers, "Order ID") && has(headers, "Order Date")) {
    return "orders";
  }
  return null;
}