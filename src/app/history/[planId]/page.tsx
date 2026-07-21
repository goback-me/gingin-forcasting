"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChannelBadge from "@/components/ChannelBadge";

type HistoryEntry = {
  id: string;
  action: string;
  previousQty: number | null;
  newQty: number | null;
  actor: string | null;
  note: string | null;
  createdAt: string;
};

type PlanItem = {
  id: string;
  productName: string;
  category: string;
  channel: "Market" | "Online";
  recommendedQty: number;
  recommendedKg: number | null;
  approvedQty: number | null;
  approvedKg: number | null;
  decision: string;
  alertStatus: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  history: HistoryEntry[];
};

type Plan = {
  id: string;
  weekStart: string;
  status: string;
  lockedAt: string | null;
  lockedBy: string | null;
  items: PlanItem[];
};

export default function PlanDetailPage() {
  const params = useParams();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetch(`/api/plans/${params.planId}`)
      .then((r) => r.json())
      .then((data) => setPlan(data.plan));
  }, [params.planId]);

  if (!plan) return <div className="text-inkfaint text-sm py-8">Loading…</div>;

  return (
    <div>
      <div className="font-display text-[26px] mb-1">Week of {fmt(plan.weekStart)}</div>
      <div className="text-inksoft text-[13.5px] mb-6">
        {plan.status === "locked" && plan.lockedBy
          ? `Locked by ${plan.lockedBy} on ${fmt(plan.lockedAt!)}`
          : "Still in draft — not yet locked."}
      </div>

      <div className="bg-surface border border-border rounded-lg p-5">
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Product</th>
              <th className="text-right px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Recommended</th>
              <th className="text-right px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Approved</th>
              <th className="text-left px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">Decision</th>
              <th className="text-left px-2 py-2 text-inkfaint text-[11.5px] uppercase tracking-wide border-b border-borderstrong">By</th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.id} className="border-b border-border">
                <td className="px-2 py-2.5">
                  <span className="flex items-center gap-2">
                    {item.productName}
                    <ChannelBadge channel={item.channel} />
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {item.recommendedKg !== null ? `${item.recommendedKg} kg` : `${item.recommendedQty} units`}
                </td>
                <td className="px-2 py-2.5 text-right font-mono">
                  {item.decision === "pending"
                    ? "—"
                    : item.approvedKg !== null
                    ? `${item.approvedKg} kg`
                    : `${item.approvedQty} units`}
                </td>
                <td className="px-2 py-2.5">
                  <span
                    className={`badge ${
                      item.decision === "approved"
                        ? "badge-ok"
                        : item.decision === "overridden"
                        ? "badge-high_growth"
                        : "badge-low_data"
                    }`}
                  >
                    {item.decision}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-inksoft text-[12px]">{item.reviewedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}