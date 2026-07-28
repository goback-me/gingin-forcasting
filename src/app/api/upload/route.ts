import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { importWeeklySales } from "@/lib/importWeeklySales";
import { importMonthlySales } from "@/lib/importMonthlySales";
import { importOrders } from "@/lib/importOrders";

export const dynamic = "force-dynamic";

/**
 * Lets someone upload a data file straight from the browser instead of
 * scp'ing it onto the VPS. Saves the upload to the SAME path the scheduled
 * import already reads from (so a live cron sync, once one exists, and a
 * manual upload both feed the exact same pipeline), then runs the matching
 * import immediately and returns the result.
 *
 * POST multipart/form-data:
 *   file: the .xlsx/.xls/.csv file
 *   type: "weekly" | "monthly" | "orders"
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  const type = form.get("type");

  if (!(file instanceof File)) {
    return NextResponse.json({ status: "failed", message: "No file was uploaded." }, { status: 400 });
  }
  if (type !== "weekly" && type !== "monthly" && type !== "orders") {
    return NextResponse.json(
      { status: "failed", message: `Unknown upload type "${type}". Must be weekly, monthly, or orders.` },
      { status: 400 }
    );
  }

  const targetPath =
    type === "weekly"
      ? process.env.WEEKLY_SOURCE_REF || "./data/weekly-sales.xlsx"
      : type === "monthly"
      ? process.env.MONTHLY_SOURCE_REF || "./data/quarter-sales.xls"
      : process.env.SOURCE_REF || "./data/orders-with-dates.xlsx";

  // Reject an http(s) SOURCE_REF here -- uploading a file only makes sense
  // when the configured source is a local path. If it's already a live
  // URL, uploads should go through whatever feeds that URL instead.
  if (/^https?:\/\//i.test(targetPath)) {
    return NextResponse.json(
      {
        status: "failed",
        message: `The ${type} source is currently configured as a live URL (${targetPath}), not a local file -- uploading here would have no effect. Update the source at its origin instead.`,
      },
      { status: 400 }
    );
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(targetPath, buf);
  } catch (err: any) {
    return NextResponse.json({ status: "failed", message: `Couldn't save the upload: ${err.message}` }, { status: 500 });
  }

  const result =
    type === "weekly"
      ? await importWeeklySales(targetPath)
      : type === "monthly"
      ? await importMonthlySales(targetPath)
      : await importOrders(targetPath);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}