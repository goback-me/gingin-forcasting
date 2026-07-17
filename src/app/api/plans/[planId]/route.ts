import { NextResponse } from "next/server";
import { getPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { planId: string } }) {
  const plan = await getPlan(params.planId);
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  return NextResponse.json({ plan });
}
