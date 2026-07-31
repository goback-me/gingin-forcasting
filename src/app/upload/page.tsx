"use client";
import { useEffect, useState } from "react";

type UploadType = "weekly" | "monthly" | "orders";

type UploadResult = {
  status: "success" | "partial" | "failed";
  rowCount?: number;
  weeksImported?: string[];
  monthsImported?: string[];
  orderCount?: number;
  message?: string;
};

type ImportLogEntry = {
  id: string;
  sourceType: string;
  sourceRef: string | null;
  rowCount: number;
  status: string;
  message: string | null;
  importedAt: string;
};

const CARDS: { type: UploadType; title: string; description: string; accept: string }[] = [
  {
    type: "weekly",
    title: "Weekly Market sales",
    description: "The weekly PLU export covering all 7 markets -- one row per product per week.",
    accept: ".xlsx,.xls",
  },
  {
    type: "monthly",
    title: "Monthly Online sales",
    description: "The monthly sales report (one sheet per month) covering the Online store.",
    accept: ".xlsx,.xls",
  },
  {
    type: "orders",
    title: "Orders (category/subcategory source)",
    description: "Per-order line items -- this is also where real Category/Subcategory data comes from once it's included.",
    accept: ".xlsx,.xls,.csv",
  },
];

export default function UploadPage() {
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  function refreshLogs() {
    setLoadingLogs(true);
    fetch("/api/import-logs")
      .then((r) => r.json())
      .then((data) => {
        setLogs(data.logs);
        setLoadingLogs(false);
      });
  }

  useEffect(() => {
    refreshLogs();
  }, []);

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Upload data</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Upload a fresh export and it's imported immediately -- no need to touch the VPS. Re-uploading the same
        period just overwrites those numbers, so it's always safe to re-run.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {CARDS.map((card) => (
          <UploadCard key={card.type} {...card} onDone={refreshLogs} />
        ))}
      </div>

      <div className="font-display text-[18px] mb-3">Recent imports</div>
      <div className="bg-surface border border-border rounded-lg p-5">
        {loadingLogs ? (
          <div className="text-inkfaint text-sm py-6 text-center">Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-inkfaint text-sm py-6 text-center">No imports yet.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-[12.5px] border-b border-border last:border-0 py-2">
                <span className={`badge ${log.status === "success" ? "badge-ok" : log.status === "partial" ? "badge-high_growth" : "badge-declining"}`}>
                  {log.status}
                </span>
                <span className="font-mono text-inksoft w-28 shrink-0">{log.sourceType}</span>
                <span className="text-inkfaint flex-1 min-w-0 truncate">{log.sourceRef}</span>
                <span className="text-inksoft w-20 text-right shrink-0">{log.rowCount} rows</span>
                <span className="text-inkfaint w-32 text-right shrink-0">{fmtDateTime(log.importedAt)}</span>
                {log.message && (
                  <span className="text-brick-strong text-[11.5px] w-40 shrink-0 truncate" title={log.message}>
                    {log.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadCard({
  type,
  title,
  description,
  accept,
  onDone,
}: {
  type: UploadType;
  title: string;
  description: string;
  accept: string;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function doUpload() {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
      onDone();
    } catch (err: any) {
      setResult({ status: "failed", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col">
      <div className="text-[14px] font-medium mb-1">{title}</div>
      <div className="text-[12px] text-inkfaint mb-3 flex-1">{description}</div>

      <input
        type="file"
        accept={accept}
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setResult(null);
        }}
        className="text-[12px] mb-3"
      />

      <button
        disabled={!file || busy}
        onClick={doUpload}
        className="bg-green-strong text-white rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-green disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {busy ? "Uploading…" : "Upload & Import"}
      </button>

      {result && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-[12px] ${
            result.status === "success" ? "bg-green-soft text-green-strong" : "bg-brick-soft text-brick-strong"
          }`}
        >
          {result.status === "success" ? (
            <>
              Imported {result.rowCount} rows
              {result.weeksImported && result.weeksImported.length > 0 && ` across ${result.weeksImported.length} week(s)`}
              {result.monthsImported && result.monthsImported.length > 0 && ` across ${result.monthsImported.length} month(s)`}
              {typeof result.orderCount === "number" && ` (${result.orderCount} orders)`}
              .
            </>
          ) : (
            result.message || "Something went wrong."
          )}
        </div>
      )}
    </div>
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}