"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import ChannelBadge from "@/components/ChannelBadge";
import ChannelTabs from "@/components/ChannelTabs";
import { buildCategoryRollup, type ProductRollup } from "@/lib/planRollup";

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
  subCategory: string | null;
  productCode: string | null;
  channel: "Market" | "Online";
  marketName: string | null;
  recommendedQty: number;
  recommendedKg: number | null;
  approvedQty: number | null;
  approvedKg: number | null;
  decision: "pending" | "approved" | "overridden";
  alertStatus: string;
  alertReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  history: HistoryEntry[];
};

type Plan = {
  id: string;
  weekStart: string;
  status: "draft" | "locked";
  items: PlanItem[];
};

function ReviewPageInner() {
  const searchParams = useSearchParams();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [actor, setActor] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "alerts">("all");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"Market" | "Online">("Market");
  const [marketFilter, setMarketFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"list" | "category">("list");
  const [rollupChannel, setRollupChannel] = useState<"all" | "Market" | "Online">("all");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setActor(localStorage.getItem("gingin_reviewer_name") || "");
    const fromLink = searchParams.get("product");
    const fromChannel = searchParams.get("channel");
    if (fromLink) {
      setSearch(fromLink);
      setFilter("all");
    }
    if (fromChannel === "Market" || fromChannel === "Online") setActiveTab(fromChannel);
    refresh();
  }, []);

  useEffect(() => {
    // Once the plan loads, if we arrived from an Alerts link, auto-expand
    // that exact item so the reviewer doesn't have to click it again.
    // Matches on channel too when present, since the same product name can
    // now appear as two separate lines (Market and Online).
    const fromLink = searchParams.get("product");
    const fromChannel = searchParams.get("channel");
    if (fromLink && plan) {
      const match = plan.items.find(
        (i) => i.productName === fromLink && (!fromChannel || i.channel === fromChannel)
      );
      if (match) {
        setExpanded(match.id);
        setActiveTab(match.channel);
      }
    }
  }, [plan]);

  function refresh() {
    setLoading(true);
    fetch("/api/plans/current")
      .then((r) => r.json())
      .then((data) => {
        setPlan(data.plan);
        setLoading(false);
      });
  }

  function saveActorName(name: string) {
    setActor(name);
    localStorage.setItem("gingin_reviewer_name", name);
  }

  async function doAction(itemId: string, body: any) {
    if (!actor.trim()) {
      alert("Enter your name at the top first -- every action is tracked against who made it.");
      return;
    }
    await fetch(`/api/plans/${plan!.id}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, actor }),
    });
    refresh();
  }

  async function lockPlan() {
    if (!confirm("Lock this week's plan? Locked plans become the permanent historical record.")) return;
    await fetch(`/api/plans/${plan!.id}/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor }),
    });
    refresh();
  }

  const items = plan?.items ?? [];
  const marketNames = useMemo(
    () =>
      Array.from(new Set(items.filter((i) => i.channel === "Market" && i.marketName).map((i) => i.marketName as string))).sort(),
    [items]
  );
  const marketCount = useMemo(() => items.filter((i) => i.channel === "Market").length, [items]);
  const onlineCount = useMemo(() => items.filter((i) => i.channel === "Online").length, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((i) => i.channel === activeTab);
    if (activeTab === "Market" && marketFilter) list = list.filter((i) => i.marketName === marketFilter);
    if (filter === "pending") list = list.filter((i) => i.decision === "pending");
    if (filter === "alerts") list = list.filter((i) => i.alertStatus !== "ok" && i.decision === "pending");
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.productName.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeTab, marketFilter, filter, search]);

  const reviewedCount = filtered.filter((i) => i.decision !== "pending").length;
  const openAlertCount = filtered.filter((i) => i.alertStatus !== "ok" && i.decision === "pending").length;

  // Category rollup is a dashboard view that can show Market only, Online
  // only, or both consolidated -- selectable via rollupChannel, independent
  // of the List view's channel tab. Search box applies on top either way.
  const rollupSourceItems = useMemo(() => {
    let list = items;
    if (rollupChannel !== "all") list = list.filter((i) => i.channel === rollupChannel);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.productName.toLowerCase().includes(q));
    }
    return list;
  }, [items, search, rollupChannel]);
  const categoryRollup = useMemo(() => buildCategoryRollup(rollupSourceItems), [rollupSourceItems]);

  function toggleCat(category: string) {
    setExpandedCats((s) => {
      const next = new Set(s);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  }
  function toggleSub(key: string) {
    setExpandedSubs((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  if (loading) return <div className="text-inkfaint text-sm py-8">Loading this week's plan…</div>;
  if (!plan) return <div>Couldn't load a plan.</div>;

  return (
    <div>
      <div className="font-display text-[26px] mb-1">This week's plan</div>
      <div className="text-inksoft text-[13.5px] mb-1">
        Week of {fmt(plan.weekStart)} — go through each product, approve the recommended number or
        override it, then lock the plan once everything's reviewed. Every action here is saved permanently.
      </div>
      <div className="text-inksoft text-[13.5px] mb-4">
        {reviewedCount} of {items.length} reviewed · {openAlertCount} alert{openAlertCount === 1 ? "" : "s"} still open
        {plan.status === "locked" && (
          <span className="ml-2 badge badge-ok">Locked {plan.status === "locked" ? "" : ""}</span>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg p-4 mb-5 flex items-center gap-3 flex-wrap">
        <label className="text-[13px] text-inksoft">Reviewing as:</label>
        <input
          className="border border-borderstrong rounded-lg px-3 py-1.5 text-[13px] w-56"
          placeholder="Your name"
          value={actor}
          onChange={(e) => saveActorName(e.target.value)}
        />
        {plan.status === "draft" ? (
          <button
            className="ml-auto bg-green-strong text-white rounded-lg px-4 py-2 text-[13px] font-medium hover:bg-green"
            onClick={lockPlan}
          >
            Lock this week's plan
          </button>
        ) : (
          <span className="ml-auto badge badge-ok">Locked — read only</span>
        )}
      </div>

      <div className="flex gap-1.5 mb-4">
        <button
          className={`rounded-lg px-4 py-2 text-[13px] font-medium ${
            viewMode === "list" ? "bg-green-strong text-white" : "border border-borderstrong hover:bg-surface2"
          }`}
          onClick={() => setViewMode("list")}
        >
          List view
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-[13px] font-medium ${
            viewMode === "category" ? "bg-green-strong text-white" : "border border-borderstrong hover:bg-surface2"
          }`}
          onClick={() => setViewMode("category")}
        >
          Category view
        </button>
      </div>

      {viewMode === "list" ? (
        <>
          <ChannelTabs
            active={activeTab}
            onChange={(c) => {
              setActiveTab(c);
              setMarketFilter("");
            }}
            marketCount={marketCount}
            onlineCount={onlineCount}
          />

          <div className="flex gap-2.5 mb-4 flex-wrap items-center">
            <input
              className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64"
              placeholder="Search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {activeTab === "Market" && marketNames.length > 0 && (
              <select
                className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-40 bg-white"
                value={marketFilter}
                onChange={(e) => setMarketFilter(e.target.value)}
              >
                <option value="">All markets</option>
                {marketNames.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <select
              className="border border-borderstrong rounded-lg px-2.5 py-2 text-[13px] w-56 bg-white"
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
            >
              <option value="all">Everything</option>
              <option value="alerts">Needs review (open alerts)</option>
              <option value="pending">All pending</option>
            </select>
          </div>

          <div className="bg-surface border border-border rounded-lg p-5">
            {filtered.length === 0 && (
              <div className="text-inkfaint text-sm py-8 text-center">Nothing here — try a different filter.</div>
            )}
            {filtered.map((item) => (
              <div key={item.id} className="border-b border-border last:border-0 py-3.5">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium flex items-center gap-2">
                      {item.productName}
                      <ChannelBadge channel={item.channel} />
                      {item.marketName && <span className="text-[11px] text-inkfaint">{item.marketName}</span>}
                      {item.alertStatus !== "ok" && (
                        <span className={`badge badge-${item.alertStatus}`}>{item.alertStatus.replace("_", " ")}</span>
                      )}
                    </div>
                    <div className="text-[11.5px] text-inkfaint">
                      {item.category}
                      {item.subCategory && <> / {item.subCategory}</>}
                    </div>
                  </div>
                  <div className="text-[12.5px] text-inkfaint w-32 text-right">
                    Rec: {item.recommendedKg !== null ? `${item.recommendedKg} kg` : `${item.recommendedQty} units`}
                  </div>
                  <div className="w-28 text-right">
                    <DecisionBadge decision={item.decision} />
                  </div>
                  <div className="text-inkfaint text-xs w-4">{expanded === item.id ? "▲" : "▼"}</div>
                </div>

                {expanded === item.id && (
                  <div className="mt-3 pl-1 pt-3 border-t border-border">
                    {item.alertReason && (
                      <div className="bg-amber-soft text-amber-strong rounded-lg px-3 py-2 text-[12.5px] mb-3">
                        {item.alertReason}
                      </div>
                    )}

                    {plan.status === "draft" && (
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <button
                          className="bg-green-strong text-white rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium hover:bg-green"
                          onClick={() => doAction(item.id, { action: "approve" })}
                        >
                          Approve as recommended
                        </button>
                        <input
                          className="border border-borderstrong rounded-lg px-2.5 py-1.5 text-[12.5px] w-24"
                          placeholder="Override qty"
                          value={overrideDrafts[item.id] ?? ""}
                          onChange={(e) => setOverrideDrafts((d) => ({ ...d, [item.id]: e.target.value }))}
                        />
                        <button
                          className="border border-borderstrong rounded-lg px-3.5 py-1.5 text-[12.5px] hover:bg-surface2"
                          onClick={() => {
                            const qty = Number(overrideDrafts[item.id]);
                            if (!Number.isFinite(qty)) return alert("Enter a valid number first.");
                            doAction(item.id, { action: "override", qty });
                          }}
                        >
                          Override
                        </button>
                        {item.decision !== "pending" && (
                          <button
                            className="text-[12.5px] text-brick-strong underline-offset-2 hover:underline ml-2"
                            onClick={() => doAction(item.id, { action: "reopen" })}
                          >
                            Reopen (undo)
                          </button>
                        )}
                      </div>
                    )}

                    {item.decision !== "pending" && (
                      <div className="text-[12.5px] text-inksoft mb-3">
                        {item.decision === "approved" ? "Approved" : "Overridden"} at{" "}
                        <span className="font-mono">
                          {item.approvedKg !== null ? `${item.approvedKg} kg` : `${item.approvedQty} units`}
                        </span>{" "}
                        by {item.reviewedBy} on {item.reviewedAt ? fmt(item.reviewedAt) : ""}
                      </div>
                    )}

                    <div className="text-[11px] text-inkfaint uppercase tracking-wide mb-1.5">History</div>
                    {item.history.length === 0 ? (
                      <div className="text-[12px] text-inkfaint">No actions yet.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {item.history.map((h) => (
                          <div key={h.id} className="text-[12px] text-inksoft flex gap-2">
                            <span className="text-inkfaint font-mono w-32 shrink-0">{fmtDateTime(h.createdAt)}</span>
                            <span>
                              <span className="font-medium">{h.actor ?? "Unknown"}</span> {describeAction(h)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="text-inksoft text-[12.5px] mb-4">
            Consolidated across Market (all 7 markets combined) and Online — subcategory and category totals roll
            up from the individual product numbers below. Category and subcategory names are a placeholder guess
            from the product name until the client's real category file arrives.
          </div>
          <div className="flex gap-2.5 mb-4 flex-wrap items-center">
            <input
              className="border border-borderstrong rounded-lg px-3 py-2 text-[13px] w-64"
              placeholder="Search product…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex gap-1.5">
              <button
                className={`rounded-lg px-3 py-2 text-[12.5px] font-medium ${
                  rollupChannel === "all" ? "bg-green-strong text-white" : "border border-borderstrong hover:bg-surface2"
                }`}
                onClick={() => setRollupChannel("all")}
              >
                Market + Online (consolidated)
              </button>
              <button
                className={`rounded-lg px-3 py-2 text-[12.5px] font-medium ${
                  rollupChannel === "Market" ? "bg-green-strong text-white" : "border border-borderstrong hover:bg-surface2"
                }`}
                onClick={() => setRollupChannel("Market")}
              >
                Market only
              </button>
              <button
                className={`rounded-lg px-3 py-2 text-[12.5px] font-medium ${
                  rollupChannel === "Online" ? "bg-green-strong text-white" : "border border-borderstrong hover:bg-surface2"
                }`}
                onClick={() => setRollupChannel("Online")}
              >
                Online only
              </button>
            </div>
          </div>
          <CategoryRollupView
            rollup={categoryRollup}
            channelView={rollupChannel}
            expandedCats={expandedCats}
            expandedSubs={expandedSubs}
            onToggleCat={toggleCat}
            onToggleSub={toggleSub}
          />
        </>
      )}
    </div>
  );
}

function CategoryRollupView({
  rollup,
  channelView,
  expandedCats,
  expandedSubs,
  onToggleCat,
  onToggleSub,
}: {
  rollup: ReturnType<typeof buildCategoryRollup>;
  channelView: "all" | "Market" | "Online";
  expandedCats: Set<string>;
  expandedSubs: Set<string>;
  onToggleCat: (category: string) => void;
  onToggleSub: (key: string) => void;
}) {
  if (rollup.length === 0) {
    return <div className="text-inkfaint text-sm py-8 text-center">Nothing here — try a different search.</div>;
  }
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      {rollup.map((cat) => (
        <div key={cat.category} className="border-b border-border last:border-0 py-3">
          <div
            className="flex items-center justify-between cursor-pointer gap-3"
            onClick={() => onToggleCat(cat.category)}
          >
            <div className="font-display text-[15px]">{cat.category}</div>
            <div className="flex items-center gap-4 text-right">
              {channelView !== "Online" && (
                <span className={channelView === "Market" ? "text-[13.5px] text-green-strong font-medium" : "text-[11px] text-inkfaint"}>
                  Market <span className="font-mono">{cat.marketKg} kg</span>
                </span>
              )}
              {channelView !== "Market" && (
                <span className={channelView === "Online" ? "text-[13.5px] text-green-strong font-medium" : "text-[11px] text-inkfaint"}>
                  Online <span className="font-mono">{cat.onlineQty} qty · {cat.onlineKg} kg</span>
                </span>
              )}
              {channelView === "all" && (
                <span className="text-[13.5px] text-green-strong font-medium">
                  Combined <span className="font-mono">{cat.totalKg} kg</span>
                </span>
              )}
              <span className="text-inkfaint text-xs w-3 text-center">{expandedCats.has(cat.category) ? "▲" : "▼"}</span>
            </div>
          </div>

          {expandedCats.has(cat.category) && (
            <div className="pl-3 mt-2.5 space-y-1">
              {cat.subcategories.map((sub) => {
                const subKey = `${cat.category}::${sub.subCategory}`;
                return (
                  <div key={subKey} className="border-l-2 border-border pl-3">
                    <div
                      className="flex items-center justify-between cursor-pointer py-1.5 gap-3"
                      onClick={() => onToggleSub(subKey)}
                    >
                      <div className="text-[13px] text-inksoft font-medium">{sub.subCategory}</div>
                      <div className="flex items-center gap-4 text-right">
                        {channelView !== "Online" && (
                          <span className={channelView === "Market" ? "text-[12.5px] text-inksoft font-medium" : "text-[10.5px] text-inkfaint"}>
                            Market <span className="font-mono">{sub.marketKg} kg</span>
                          </span>
                        )}
                        {channelView !== "Market" && (
                          <span className={channelView === "Online" ? "text-[12.5px] text-inksoft font-medium" : "text-[10.5px] text-inkfaint"}>
                            Online <span className="font-mono">{sub.onlineQty} qty · {sub.onlineKg} kg</span>
                          </span>
                        )}
                        {channelView === "all" && (
                          <span className="text-[12.5px] text-inksoft font-medium">
                            Combined <span className="font-mono">{sub.totalKg} kg</span>
                          </span>
                        )}
                        <span className="text-inkfaint text-xs w-3 text-center">
                          {expandedSubs.has(subKey) ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {expandedSubs.has(subKey) && (
                      <div className="pb-2">
                        <div
                          className={`grid gap-2 text-[10.5px] text-inkfaint uppercase tracking-wide py-1 border-b border-border ${
                            channelView === "all" ? "grid-cols-[1fr_110px_170px_110px]" : "grid-cols-[1fr_170px]"
                          }`}
                        >
                          <div>Product</div>
                          {channelView !== "Online" && <div className="text-right">Market</div>}
                          {channelView !== "Market" && <div className="text-right">Online (qty · kg)</div>}
                          {channelView === "all" && <div className="text-right">Combined</div>}
                        </div>
                        {sub.products.map((p) => (
                          <ProductRollupRow key={p.productName} p={p} channelView={channelView} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProductRollupRow({ p, channelView }: { p: ProductRollup; channelView: "all" | "Market" | "Online" }) {
  return (
    <div
      className={`grid gap-2 text-[12.5px] py-2 border-b border-border last:border-0 items-center ${
        channelView === "all" ? "grid-cols-[1fr_110px_170px_110px]" : "grid-cols-[1fr_170px]"
      }`}
    >
      <div className="min-w-0">
        {p.productName}
        {p.productCode && <span className="text-inkfaint text-[11px] ml-1.5">#{p.productCode}</span>}
      </div>
      {channelView !== "Online" && (
        <div className="text-right font-mono text-inksoft">{p.marketKg !== null ? `${p.marketKg} kg` : "—"}</div>
      )}
      {channelView !== "Market" && (
        <div className="text-right font-mono text-inksoft">
          {p.onlineKg !== null ? `${p.onlineQty} qty · ${p.onlineKg} kg` : p.onlineQty ? `${p.onlineQty} qty` : "—"}
        </div>
      )}
      {channelView === "all" && <div className="text-right font-mono font-medium">{p.combinedKg} kg</div>}
    </div>
  );
}

function describeAction(h: HistoryEntry): string {
  if (h.action === "approved") return `approved the recommended value (${h.newQty} units).`;
  if (h.action === "overridden") return `overrode ${h.previousQty ?? "—"} → ${h.newQty} units.`;
  if (h.action === "edited") return `edited the override: ${h.previousQty ?? "—"} → ${h.newQty} units.`;
  if (h.action === "reopened") return `reopened this item for re-review.`;
  return h.action;
}

function DecisionBadge({ decision }: { decision: string }) {
  if (decision === "approved") return <span className="badge badge-ok">Approved</span>;
  if (decision === "overridden") return <span className="badge badge-high_growth">Overridden</span>;
  return <span className="badge badge-low_data">Pending</span>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function ReviewPage() {
  return (
    <Suspense fallback={<div className="text-inkfaint text-sm py-8">Loading…</div>}>
      <ReviewPageInner />
    </Suspense>
  );
}