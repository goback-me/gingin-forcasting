"use client";
import { useEffect, useRef, useState } from "react";
import ChannelBadge from "./ChannelBadge";
import StatusBadge from "./StatusBadge";

export type ColumnMeta = { key: string; label: string; type: string };

export default function ReportTable({
  columns,
  columnByKey,
  rows,
}: {
  columns: string[];
  columnByKey: Map<string, ColumnMeta>;
  rows: any[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(800);

  useEffect(() => {
    function updateWidth() {
      if (tableRef.current) setTableWidth(tableRef.current.scrollWidth);
    }
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    if (tableRef.current) ro.observe(tableRef.current);
    window.addEventListener("resize", updateWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, [columns, rows.length]);

  function syncFromTop() {
    if (scrollRef.current && topScrollRef.current) scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
  }
  function syncFromBottom() {
    if (scrollRef.current && topScrollRef.current) topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
  }

  if (columns.length === 0) {
    return (
      <div className="text-inkfaint text-sm py-10 text-center bg-surface border border-border rounded-lg">
        No columns to show.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <div
        ref={topScrollRef}
        onScroll={syncFromTop}
        className="overflow-x-auto themed-scrollbar border-b border-border"
        style={{ height: 14 }}
      >
        <div style={{ width: tableWidth, height: 1 }} />
      </div>
      <div ref={scrollRef} onScroll={syncFromBottom} className="overflow-x-auto themed-scrollbar">
        <table ref={tableRef} className="min-w-full text-[12.5px] border-collapse">
          <thead>
            <tr>
              {columns.map((key, i) => (
                <th
                  key={key}
                  className={`text-left px-3 py-2.5 text-inkfaint text-[11px] uppercase tracking-wide border-b border-borderstrong whitespace-nowrap ${
                    i === 0 ? "sticky left-0 bg-surface z-10" : ""
                  }`}
                >
                  {columnByKey.get(key)?.label ?? key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="text-inkfaint text-sm py-10 text-center">
                  Nothing matches these filters.
                </td>
              </tr>
            ) : (
              rows.map((p, i) => (
                <tr
                  key={`${p.name}::${p.channel}::${i}`}
                  className={`border-b border-border last:border-0 hover:bg-surface2 ${i % 2 === 1 ? "bg-surface2/40" : ""}`}
                >
                  {columns.map((key, ci) => (
                    <td key={key} className={`px-3 py-2.5 whitespace-nowrap ${ci === 0 ? "sticky left-0 bg-inherit z-10 max-w-[240px] truncate" : ""}`}>
                      {renderReportValue(p, key, columnByKey.get(key)?.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function renderReportValue(p: any, key: string, type: string | undefined) {
  const val = p[key];
  if (val === null || val === undefined || val === "") return <span className="text-inkfaint">—</span>;

  if (key === "channel") return <ChannelBadge channel={val} />;
  if (key === "status") return <StatusBadge status={val} />;
  if (type === "badge") return <span className={`badge badge-${val}`}>{String(val).replace("_", " ")}</span>;
  if (type === "kg") return <span className="font-mono">{val} kg</span>;
  if (type === "percent") return <span className="font-mono">{val}%</span>;
  return <span>{String(val)}</span>;
}