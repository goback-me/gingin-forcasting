import { NextResponse } from "next/server";
import { importOrders } from "@/lib/importOrders";

export const dynamic = "force-dynamic";

// Trigger with: curl -X POST http://localhost:3000/api/import
// Point a cron job (system cron, or your VPS's scheduler) at this endpoint
// on whatever cadence makes sense once SOURCE_REF is a live Google Sheet.
export async function POST() {
  const result = await importOrders();
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
