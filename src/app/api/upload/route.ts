import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { importWeeklySales } from "@/lib/importWeeklySales";
import { importMonthlySales } from "@/lib/importMonthlySales";
import { importOrders } from "@/lib/importOrders";
import { importProductCatalog } from "@/lib/importProductCatalog";
import { detectFileType, DetectedFileType } from "@/lib/dataSource/detectFileType";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<DetectedFileType, string> = {
  weekly: "Weekly Market sales",
  monthly: "Monthly Online sales",
  orders: "Orders",
  catalog: "Product catalog",
};

/**
 * Lets someone upload ANY of the four data files without knowing or
 * picking which kind it is -- the file's own column headers say what it
 * is (see detectFileType.ts). Saves it to the same path the scheduled
 * import already reads from, runs the matching import immediately, and
 * reports back what it detected plus the result.
 *
 * POST multipart/form-data:
 *   file: the .xlsx/.xls/.csv file
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ status: "failed", message: "No file was uploaded." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const type = detectFileType(buf);

  if (!type) {
    return NextResponse.json(
      {
        status: "failed",
        message:
          "Couldn't tell what kind of file this is from its columns. Expected one of: a Weekly Market export (has a PLU_Rollup_Desc column), a Monthly Online report (has Product title + Items sold), an Orders file (has Order ID + Order Date), or a Product catalog (has MSA Grade / Parent Code).",
      },
      { status: 400 }
    );
  }

  if (type === "catalog" && process.env.CATALOG_SHEET_ID) {
    return NextResponse.json(
      {
        status: "failed",
        detectedType: type,
        message: "The product catalog is set up as a live private Google Sheet -- edit the sheet directly rather than uploading a file here.",
      },
      { status: 400 }
    );
  }

  const targetPath =
    type === "weekly"
      ? process.env.WEEKLY_SOURCE_REF || "./data/weekly-sales.xlsx"
      : type === "monthly"
      ? process.env.MONTHLY_SOURCE_REF || "./data/quarter-sales.xls"
      : type === "catalog"
      ? process.env.CATALOG_SOURCE_REF || "./data/product-catalog.xlsx"
      : process.env.SOURCE_REF || "./data/orders-with-dates.xlsx";

  // Reject an http(s) SOURCE_REF here -- uploading a file only makes sense
  // when the configured source is a local path. If it's already a live
  // URL, uploads should go through whatever feeds that URL instead.
  if (/^https?:\/\//i.test(targetPath)) {
    return NextResponse.json(
      {
        status: "failed",
        detectedType: type,
        message: `Detected this as ${TYPE_LABELS[type]}, but that source is currently configured as a live URL (${targetPath}), not a local file -- uploading here would have no effect. Update the source at its origin instead.`,
      },
      { status: 400 }
    );
  }

  try {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buf);
  } catch (err: any) {
    return NextResponse.json({ status: "failed", detectedType: type, message: `Couldn't save the upload: ${err.message}` }, { status: 500 });
  }

  const result =
    type === "weekly"
      ? await importWeeklySales(targetPath)
      : type === "monthly"
      ? await importMonthlySales(targetPath)
      : type === "catalog"
      ? await importProductCatalog(targetPath)
      : await importOrders(targetPath);

  return NextResponse.json({ ...result, detectedType: type, detectedLabel: TYPE_LABELS[type] }, { status: result.status === "failed" ? 500 : 200 });
}