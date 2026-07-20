import { NextRequest, NextResponse } from "next/server";
import { computeWeeklyForecast } from "@/lib/weeklyForecast";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const demandPct = Number(params.get("demandPct") ?? 0);
  const promoPct = Number(params.get("promoPct") ?? 0);
  const bufferPct = Number(params.get("bufferPct") ?? 10);

  const result = await computeWeeklyForecast({ demandPct, promoPct, bufferPct });
  return NextResponse.json(result);
}
