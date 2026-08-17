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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB -- generous for these files (biggest seen so far is a few MB), stops disk-filling abuse
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ status: "failed", message: "No file was uploaded." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { status: "failed", message: `That file is too large (${Math.round(file.size / 1024 / 1024)}MB). Max is ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const ext = path.extname(file.name || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { status: "failed", message: `"${ext || "(no extension)"}" isn't a supported file type. Use .xlsx, .xls, or .csv.` },
      { status: 400 }
    );
  }

  let buf: Buffer;
  let type: DetectedFileType | null;
  try {
    buf = Buffer.from(await file.arrayBuffer());
    type = detectFileType(buf);
  } catch {
    // Don't leak parser internals for a malformed/corrupt/malicious file --
    // just say it couldn't be read.
    return NextResponse.json({ status: "failed", message: "Couldn't read that file -- it may be corrupted or not a real spreadsheet." }, { status: 400 });
  }

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
    return NextResponse.json({ status: "failed", detectedType: type, message: "Couldn't save the upload -- check server permissions on the data folder." }, { status: 500 });
  }

  try {
    const result =
      type === "weekly"
        ? await importWeeklySales(targetPath)
        : type === "monthly"
        ? await importMonthlySales(targetPath)
        : type === "catalog"
        ? await importProductCatalog(targetPath)
        : await importOrders(targetPath);

    return NextResponse.json({ ...result, detectedType: type, detectedLabel: TYPE_LABELS[type] }, { status: result.status === "failed" ? 500 : 200 });
  } catch {
    return NextResponse.json(
      { status: "failed", detectedType: type, message: "The file was detected and saved, but importing it failed -- check it matches the expected column layout." },
      { status: 500 }
    );
  }
}