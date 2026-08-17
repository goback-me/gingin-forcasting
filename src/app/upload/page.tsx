"use client";
import { useEffect, useState } from "react";

type UploadResult = {
  status: "success" | "partial" | "failed";
  rowCount?: number;
  weeksImported?: string[];
  monthsImported?: string[];
  orderCount?: number;
  message?: string;
  detectedType?: string;
  detectedLabel?: string;
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

export default function UploadPage() {
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

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

  async function doUpload(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      setResult(data);
      refreshLogs();
    } catch (err: any) {
      setResult({ status: "failed", message: err.message });
    } finally {
      setBusy(false);
    }
  }

  function handleFileChosen(fileList: FileList | null) {
    const file = fileList?.[0];
    if (file) doUpload(file);
  }

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Upload data</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Drop in any of your data files -- weekly Market export, monthly Online report, orders, or the product
        catalog -- it figures out which one it is from the file itself and imports it straight away.
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFileChosen(e.dataTransfer.files);
        }}
        className={`block border-2 border-dashed rounded-lg px-6 py-12 text-center cursor-pointer transition-colors mb-4 ${
          dragOver ? "border-green bg-green-soft" : "border-borderstrong bg-surface hover:bg-surface2"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFileChosen(e.target.files)}
        />
        <div className="text-[15px] font-medium mb-1">{busy ? "Uploading…" : "Drop a file here, or click to choose one"}</div>
        <div className="text-[12.5px] text-inkfaint">.xlsx, .xls, or .csv -- any of the 4 data files</div>
      </label>

      {result && (
        <div
          className={`rounded-lg px-4 py-3 text-[13px] mb-6 ${
            result.status === "success" ? "bg-green-soft text-green-strong" : "bg-brick-soft text-brick-strong"
          }`}
        >
          {result.status === "success" ? (
            <>
              <span className="font-medium">Detected: {result.detectedLabel}.</span> Imported {result.rowCount} rows
              {result.weeksImported && result.weeksImported.length > 0 && ` across ${result.weeksImported.length} week(s)`}
              {result.monthsImported && result.monthsImported.length > 0 && ` across ${result.monthsImported.length} month(s)`}
              {typeof result.orderCount === "number" && ` (${result.orderCount} orders)`}.
            </>
          ) : (
            <>
              {result.detectedLabel && <span className="font-medium">Detected: {result.detectedLabel}. </span>}
              {result.message || "Something went wrong."}
            </>
          )}
        </div>
      )}

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
                <span
                  className={`badge ${
                    log.status === "success" ? "badge-ok" : log.status === "partial" ? "badge-high_growth" : "badge-declining"
                  }`}
                >
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

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}