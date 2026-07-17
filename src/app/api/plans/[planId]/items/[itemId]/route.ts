import { NextRequest, NextResponse } from "next/server";
import { approveItem, overrideItem, reopenItem } from "@/lib/plans";

export const dynamic = "force-dynamic";

// Body: { action: "approve" | "override" | "reopen", actor: string, qty?: number, note?: string }
export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const body = await req.json();
  const actor: string = body.actor || "Unknown";

  try {
    let item;
    if (body.action === "approve") {
      item = await approveItem(params.itemId, actor);
    } else if (body.action === "override") {
      if (typeof body.qty !== "number") {
        return NextResponse.json({ error: "qty is required for override" }, { status: 400 });
      }
      item = await overrideItem(params.itemId, body.qty, actor, body.note);
    } else if (body.action === "reopen") {
      item = await reopenItem(params.itemId, actor);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ item });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
