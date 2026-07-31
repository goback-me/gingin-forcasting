"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReportTable, { ColumnMeta } from "@/components/ReportTable";
import { applyReportFilters, sortReportRows, DEFAULT_REPORT_FILTERS, ReportFilters } from "@/lib/reportShared";

type SavedViewDTO = {
  id: string;
  name: string;
  columns: string[];
  filters: ReportFilters;
  sortKey: string | null;
  sortDir: number;
  updatedAt: string;
};

export default function ReportViewerPage() {
  const params = useParams<{ viewId: string }>();
  const router = useRouter();

  const [view, setView] = useState<SavedViewDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [allColumns, setAllColumns] = useState<ColumnMeta[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/views/${params.viewId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setNotFound(true);
          return;
        }
        setView(data.view);
      });
    Promise.all([fetch("/api/columns").then((r) => r.json()), fetch("/api/products").then((r) => r.json())]).then(
      ([colData, prodData]) => {
        setAllColumns(colData.columns);
        setProducts(prodData.products);
        setLoading(false);
      }
    );
  }, [params.viewId]);

  const columnByKey = useMemo(() => new Map(allColumns.map((c) => [c.key, c])), [allColumns]);

  const rows = useMemo(() => {
    if (!view) return [];
    const filters = { ...DEFAULT_REPORT_FILTERS, ...view.filters };
    const filtered = applyReportFilters(products, filters);
    return sortReportRows(filtered, view.sortKey, (view.sortDir as 1 | -1) ?? -1);
  }, [products, view]);

  async function deleteAndGoBack() {
    if (!view) return;
    if (!confirm(`Delete the saved view "${view.name}"? This can't be undone.`)) return;
    await fetch(`/api/views/${view.id}`, { method: "DELETE" });
    router.push("/reports");
  }

  if (notFound) {
    return (
      <div>
        <Link href="/reports" className="text-[12.5px] text-inkfaint hover:text-inksoft mb-4 inline-block">
          ‹ All reports
        </Link>
        <div className="text-inkfaint text-sm py-10 text-center bg-surface border border-border rounded-lg">
          This report doesn't exist anymore -- it may have been deleted.
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link href="/reports" className="text-[12.5px] text-inkfaint hover:text-inksoft mb-2 inline-block">
        ‹ All reports
      </Link>
      <div className="flex items-start justify-between mb-1 gap-3">
        <div className="font-display text-[26px]">{view?.name ?? "Loading…"}</div>
        {view && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/reports/builder?viewId=${view.id}`}
              className="border border-borderstrong rounded-lg px-3.5 py-2 text-[12.5px] font-medium hover:bg-surface2"
            >
              Edit
            </Link>
            <button
              onClick={deleteAndGoBack}
              className="border border-borderstrong rounded-lg px-3.5 py-2 text-[12.5px] font-medium text-brick-strong hover:bg-brick-soft"
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {view && (
        <div className="text-inksoft text-[13.5px] mb-6">
          {view.columns.length} column{view.columns.length !== 1 ? "s" : ""} · updated{" "}
          {new Date(view.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      )}

      {loading || !view ? (
        <div className="text-inkfaint text-sm py-10 text-center bg-surface border border-border rounded-lg">Loading…</div>
      ) : (
        <>
          <ReportTable columns={view.columns} columnByKey={columnByKey} rows={rows} />
          <div className="text-inkfaint text-[11.5px] mt-2">{rows.length} product(s)</div>
        </>
      )}
    </div>
  );
}