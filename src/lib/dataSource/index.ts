import { OrderSource } from "./types";
import { TabularOrderSource } from "./tabularSource";

/**
 * Central switch for where order data comes from. Nothing outside this
 * file needs to know the difference between a local file and a Google
 * Sheet -- both return the same RawOrderRow[] shape.
 *
 * .env:
 *   SOURCE_REF=./data/orders-with-dates.xlsx        (local file, today)
 *   SOURCE_REF=https://docs.google.com/.../pub?output=csv   (Google Sheets, later)
 */
export function getOrderSource(): OrderSource {
  const ref = process.env.SOURCE_REF || "./data/orders-with-dates.xlsx";
  return new TabularOrderSource(ref);
}

export * from "./types";
