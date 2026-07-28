import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = await prisma.importLog.findMany({
    orderBy: { importedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ logs });
}