// Every field the importer needs, mapped to every header name we might see
// it under. Real exports (WooCommerce, Shopify, a hand-built Google Sheet)
// rarely agree on exact column names -- this lets the importer cope with
// that without a code change. Add an alias here if a new source uses a
// header we don't recognise yet; matching is case-insensitive and ignores
// surrounding whitespace.
export const HEADER_ALIASES: Record<string, string[]> = {
  orderId: ["Order ID", "Order Number", "order_id", "order id", "OrderID"],
  orderDate: ["Order Date", "order_date", "Date", "order date"],
  status: ["Order Status", "status", "order status"],
  channel: ["Origin", "Channel", "channel", "Source"],
  productName: ["Product Name", "product_name", "Product", "product"],
  sku: ["SKU", "sku", "GTIN/EAN"],
  category: ["Category", "category"],
  quantity: ["Quantity", "quantity", "qty", "Qty"],
  weightG: ["Weight", "weight_g", "weight", "Weight (g)"],
  itemCost: ["Item Cost", "item_cost", "cost", "Cost", "Price"],
};

function normalize(h: string) {
  return h.trim().toLowerCase();
}

/**
 * Given the header row of a source file/sheet, build a map from canonical
 * field name -> actual header string present in that file. Throws if a
 * required field (orderId, orderDate, productName, quantity) can't be
 * resolved, since forecasting is meaningless without those four.
 */
export function resolveHeaders(sourceHeaders: string[]): Record<string, string | undefined> {
  const normalizedSource = sourceHeaders.map((h) => ({ raw: h, norm: normalize(h) }));
  const resolved: Record<string, string | undefined> = {};

  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const match = normalizedSource.find((s) => aliases.some((a) => normalize(a) === s.norm));
    resolved[field] = match?.raw;
  }

  const required = ["orderId", "orderDate", "productName", "quantity"];
  const missing = required.filter((f) => !resolved[f]);
  if (missing.length) {
    throw new Error(
      `Import aborted -- source is missing required column(s): ${missing.join(", ")}. ` +
        `Add the header this source actually uses to HEADER_ALIASES in src/lib/dataSource/headerAliases.ts.`
    );
  }
  return resolved;
}
