"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type PlanSummary = {
  id: string;
  weekStart: string;
  status: string;
  createdAt: string;
  lockedAt: string | null;
  lockedBy: string | null;
  itemCount: number;
  approvedCount: number;
  alertCount: number;
  openAlertCount: number;
};

export default function HistoryPage() {
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans);
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Plan history</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        Every weekly plan, past and present — what was recommended, what was actually approved, and by
        whom. Nothing here is ever edited after the fact.
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        {loading && <div className="text-inkfaint text-sm py-8 text-center">Loading…</div>}
        {!loading && plans.length === 0 && (
          <div className="text-inkfaint text-sm py-8 text-center">No plans yet.</div>
        )}
        {plans.map((p) => (
          <Link
            key={p.id}
            href={`/history/${p.id}`}
            className="flex items-center gap-4 py-3.5 border-b border-border last:border-0 hover:bg-surface2 -mx-1 px-1 rounded"
          >
            <div className="flex-1">
              <div className="text-[13.5px] font-medium">Week of {fmt(p.weekStart)}</div>
              <div className="text-[11.5px] text-inkfaint">
                {p.approvedCount} of {p.itemCount} reviewed
                {p.lockedAt && p.lockedBy ? ` · Locked by ${p.lockedBy} on ${fmt(p.lockedAt)}` : ""}
              </div>
            </div>
            {p.openAlertCount > 0 && (
              <span className="badge badge-declining">{p.openAlertCount} open alert{p.openAlertCount === 1 ? "" : "s"}</span>
            )}
            <span className={`badge ${p.status === "locked" ? "badge-ok" : "badge-low_data"}`}>
              {p.status === "locked" ? "Locked" : "Draft"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
