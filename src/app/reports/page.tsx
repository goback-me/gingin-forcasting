"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type SavedViewDTO = {
  id: string;
  name: string;
  columns: string[];
  filters: Record<string, any>;
  updatedAt: string;
};

export default function ReportsListPage() {
  const [views, setViews] = useState<SavedViewDTO[] | null>(null);

  function refresh() {
    fetch("/api/views")
      .then((r) => r.json())
      .then((data) => setViews(data.views));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function deleteView(v: SavedViewDTO, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete the saved view "${v.name}"? This can't be undone.`)) return;
    await fetch(`/api/views/${v.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <div className="font-display text-[26px]">Custom reports</div>
        <Link
          href="/reports/builder"
          className="bg-green-strong text-white rounded-lg px-4 py-2.5 text-[13px] font-medium hover:bg-green"
        >
          + New report
        </Link>
      </div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Saved reports you can jump back into any time. Click one to view it, or build a new one from scratch.
      </div>

      {views === null ? (
        <div className="text-inkfaint text-sm py-10 text-center bg-surface border border-border rounded-lg">Loading…</div>
      ) : views.length === 0 ? (
        <div className="text-inkfaint text-sm py-14 text-center bg-surface border border-border rounded-lg">
          No reports saved yet -- <Link href="/reports/builder" className="text-green-strong underline-offset-2 hover:underline">
            build your first one
          </Link>
          .
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {views.map((v) => (
            <Link
              key={v.id}
              href={`/reports/${v.id}`}
              className="group bg-surface border border-border rounded-lg p-4 hover:border-green hover:shadow-sm transition-colors block"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-[14px] font-medium leading-tight">{v.name}</div>
                <button
                  className="opacity-0 group-hover:opacity-100 text-inkfaint hover:text-brick-strong text-[15px] leading-none shrink-0"
                  onClick={(e) => deleteView(v, e)}
                  title="Delete view"
                >
                  ×
                </button>
              </div>
              <div className="text-[11.5px] text-inkfaint">
                {v.columns.length} column{v.columns.length !== 1 ? "s" : ""}
                {v.filters?.channel && v.filters.channel !== "all" && <> · {v.filters.channel} only</>}
                {v.filters?.category && <> · {v.filters.category}</>}
              </div>
              <div className="text-[11px] text-inkfaint mt-2">Updated {fmtDate(v.updatedAt)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}