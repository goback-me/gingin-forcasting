import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureDefaultColumns } from "@/lib/columns";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaultColumns();
  const columns = await prisma.dashboardColumn.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ columns });
}

/**
 * Body: { updates: [{ key: "growthPct", visible: false, sortOrder: 3 }, ...] }
 * Lets a future settings screen (or a quick script) reorder/hide columns
 * without a deploy.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const updates: { key: string; visible?: boolean; sortOrder?: number; label?: string }[] =
    body.updates ?? [];

  for (const u of updates) {
    await prisma.dashboardColumn.update({
      where: { key: u.key },
      data: {
        ...(u.visible !== undefined ? { visible: u.visible } : {}),
        ...(u.sortOrder !== undefined ? { sortOrder: u.sortOrder } : {}),
        ...(u.label !== undefined ? { label: u.label } : {}),
      },
    });
  }

  const columns = await prisma.dashboardColumn.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ columns });
}
