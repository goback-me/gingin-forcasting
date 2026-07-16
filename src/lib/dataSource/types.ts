// Canonical shape every data source must produce, regardless of where the
// row came from (local xlsx today, Google Sheets or a live API tomorrow).
export interface RawOrderRow {
  orderId: string;
  orderDate: string; // ISO date string, e.g. "2026-05-12"
  status?: string;
  channel?: string;
  productName: string;
  sku?: string;
  category?: string;
  quantity: number;
  weightG?: number;
  itemCost?: number;
}

export interface OrderSource {
  /** Human-readable identifier used in the ImportLog, e.g. "csv_file" */
  sourceType: string;
  /** File path or URL, kept for traceability only */
  sourceRef: string;
  fetchRows(): Promise<RawOrderRow[]>;
}
