import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function serialize(view: any) {
  return {
    id: view.id,
    name: view.name,
    columns: JSON.parse(view.columns),
    filters: JSON.parse(view.filters),
    sortKey: view.sortKey,
    sortDir: view.sortDir,
    createdBy: view.createdBy,
    createdAt: view.createdAt,
    updatedAt: view.updatedAt,
  };
}

export async function GET(_req: Request, { params }: { params: { viewId: string } }) {
  const view = await prisma.savedView.findUnique({ where: { id: params.viewId } });
  if (!view) return NextResponse.json({ error: "View not found." }, { status: 404 });
  return NextResponse.json({ view: serialize(view) });
}

export async function DELETE(_req: Request, { params }: { params: { viewId: string } }) {
  try {
    await prisma.savedView.delete({ where: { id: params.viewId } });
  } catch (err: any) {
    // Already gone -- treat as success rather than erroring, since the
    // end state (view doesn't exist) is what the caller wanted either way.
    if (err.code !== "P2025") {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }
  return NextResponse.json({ deleted: true });
}