import { NextResponse } from "next/server";
import { listPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await listPlans();
  return NextResponse.json({ plans });
}
