import { NextRequest, NextResponse } from "next/server";
import { computeMonthlyForecast } from "@/lib/monthlyForecast";
import { getVisibleColumns } from "@/lib/columns";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const demandPct = Number(params.get("demandPct") ?? 0);
  const promoPct = Number(params.get("promoPct") ?? 0);
  const bufferPct = Number(params.get("bufferPct") ?? 10);

  const [{ products, monthsAvailable, dataWarning }, columns] = await Promise.all([
    computeMonthlyForecast({ demandPct, promoPct, bufferPct }),
    getVisibleColumns(),
  ]);

  return NextResponse.json({ products, columns, monthsAvailable, dataWarning });
}
