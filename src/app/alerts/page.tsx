"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type PlanItem = {
  id: string;
  productName: string;
  category: string;
  alertStatus: string;
  alertReason: string | null;
  decision: string;
};

const ICON: Record<string, string> = { declining: "↓", high_growth: "↑", low_data: "?" };

export default function AlertsPage() {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans/current")
      .then((r) => r.json())
      .then((data) => {
        setItems(data.plan.items);
        setWeekStart(data.plan.weekStart);
        setLoading(false);
      });
  }, []);

  const openAlerts = items.filter((i) => i.alertStatus !== "ok" && i.decision === "pending");
  const resolvedAlerts = items.filter((i) => i.alertStatus !== "ok" && i.decision !== "pending");

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Active alerts</div>
      <div className="text-inksoft text-[13.5px] mb-1">
        These are tied to this week's plan{weekStart ? ` (week of ${fmt(weekStart)})` : ""} — they clear
        once you approve or override that product on the review page.
      </div>
      <div className="text-inksoft text-[13.5px] mb-6">
        <Link href="/review" className="text-green-strong underline-offset-2 hover:underline">
          Go to this week's plan →
        </Link>
      </div>

      <div className="bg-surface border border-border rounded-lg p-5 mb-5">
        <div className="font-display text-[15px] mb-3">Needs action ({openAlerts.length})</div>
        {loading && <div className="text-inkfaint text-sm py-6 text-center">Loading…</div>}
        {!loading && openAlerts.length === 0 && (
          <div className="text-inkfaint text-sm py-6 text-center">No open alerts — everything's either fine or already reviewed.</div>
        )}
        {openAlerts.map((item) => (
          <Link
            key={item.id}
            href={`/review?product=${encodeURIComponent(item.productName)}`}
            className="flex gap-3.5 py-3.5 border-b border-border last:border-0 hover:bg-surface2 -mx-1 px-1 rounded"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[15px] badge-${item.alertStatus}`}>
              {ICON[item.alertStatus]}
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">{item.productName}</div>
              <div className="text-[12.5px] text-inksoft mt-0.5">{item.alertReason}</div>
            </div>
            <div className="text-[12px] text-green-strong self-center whitespace-nowrap">Review →</div>
          </Link>
        ))}
      </div>

      {resolvedAlerts.length > 0 && (
        <div className="bg-surface2 border border-border rounded-lg p-5">
          <div className="font-display text-[15px] mb-3">Already reviewed this week ({resolvedAlerts.length})</div>
          {resolvedAlerts.map((item) => (
            <div key={item.id} className="flex gap-3.5 py-2.5 border-b border-border last:border-0">
              <div className="text-[13px] text-inksoft flex-1">{item.productName}</div>
              <span className="badge badge-ok">{item.decision}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
