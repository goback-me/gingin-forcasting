import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const views = await prisma.savedView.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({
    views: views.map((v) => ({
      id: v.id,
      name: v.name,
      columns: JSON.parse(v.columns),
      filters: JSON.parse(v.filters),
      sortKey: v.sortKey,
      sortDir: v.sortDir,
      createdBy: v.createdBy,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
  });
}

// Saving a view with a name that already exists overwrites it (same as
// "Save" in most report-builder tools) -- the /reports page's Save button
// warns the user first when a name collides, this endpoint just does it.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, columns, filters, sortKey, sortDir, createdBy } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "A view needs a name." }, { status: 400 });
  }
  if (!Array.isArray(columns) || columns.length === 0) {
    return NextResponse.json({ error: "Pick at least one column before saving." }, { status: 400 });
  }

  const view = await prisma.savedView.upsert({
    where: { name: name.trim() },
    create: {
      name: name.trim(),
      columns: JSON.stringify(columns),
      filters: JSON.stringify(filters ?? {}),
      sortKey: sortKey ?? null,
      sortDir: sortDir ?? -1,
      createdBy: createdBy ?? null,
    },
    update: {
      columns: JSON.stringify(columns),
      filters: JSON.stringify(filters ?? {}),
      sortKey: sortKey ?? null,
      sortDir: sortDir ?? -1,
    },
  });

  return NextResponse.json({
    view: {
      id: view.id,
      name: view.name,
      columns: JSON.parse(view.columns),
      filters: JSON.parse(view.filters),
      sortKey: view.sortKey,
      sortDir: view.sortDir,
      createdBy: view.createdBy,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
    },
  });
}