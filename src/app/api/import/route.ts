import { NextRequest, NextResponse } from "next/server";
import { importOrders } from "@/lib/importOrders";
import { importWeeklySales } from "@/lib/importWeeklySales";
import { importMonthlySales } from "@/lib/importMonthlySales";
import { importProductCatalog } from "@/lib/importProductCatalog";

export const dynamic = "force-dynamic";

// Trigger with: curl -X POST "http://localhost:3000/api/import?type=orders"
// (type is one of orders | weekly | monthly | catalog, defaults to orders)
//
// Point a cron job (system cron, or your VPS's scheduler) at this endpoint
// on whatever cadence makes sense once SOURCE_REF / WEEKLY_SOURCE_REF /
// MONTHLY_SOURCE_REF / CATALOG_SOURCE_REF point at a live URL instead of a
// local file -- see scripts/scheduled-import.ts for a version that runs
// all four directly (no HTTP round-trip, no auth needed) from a VPS
// crontab entry instead.
export async function POST(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "orders";
  const result =
    type === "weekly"
      ? await importWeeklySales()
      : type === "monthly"
      ? await importMonthlySales()
      : type === "catalog"
      ? await importProductCatalog()
      : await importOrders();
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}