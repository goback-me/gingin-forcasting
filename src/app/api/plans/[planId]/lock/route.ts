import { NextRequest, NextResponse } from "next/server";
import { lockPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  const body = await req.json();
  const actor: string = body.actor || "Unknown";
  const plan = await lockPlan(params.planId, actor);
  return NextResponse.json({ plan });
}
