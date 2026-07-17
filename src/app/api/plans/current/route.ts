import { NextResponse } from "next/server";
import { getOrCreateCurrentPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const plan = await getOrCreateCurrentPlan();
  return NextResponse.json({ plan });
}
