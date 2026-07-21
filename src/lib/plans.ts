import { prisma } from "./db";
import { computeMonthlyForecast } from "./monthlyForecast";
import { getNextLockInfo } from "./lockSchedule";

/**
 * Everything to do with the weekly review/approval workflow lives here.
 * The forecast engine (monthlyForecast.ts, which merges weekly and monthly
 * sales) only ever calculates numbers live -- nothing it produces is ever
 * saved. This file is what actually turns a calculated recommendation into
 * a decision someone made, on a specific date, that gets kept forever.
 */

/** Returns this week's plan, creating it from the current forecast if it
 *  doesn't exist yet. Safe to call repeatedly -- never recreates an
 *  existing plan that already has real items in it, so approvals already
 *  made are never touched.
 *
 *  Self-repairs one specific situation: if a plan record exists but has
 *  ZERO items (which happens if it got created before real data existed
 *  -- e.g. during setup/deploy troubleshooting, when the forecast engine
 *  had nothing to snapshot yet), it backfills that plan with real items
 *  instead of leaving it permanently empty. */
export async function getOrCreateCurrentPlan() {
  const { weekStart } = getNextLockInfo();

  let plan = await prisma.forecastPlan.findUnique({
    where: { weekStart },
    include: { items: { include: { history: { orderBy: { createdAt: "desc" } } } } },
  });

  if (plan && (plan as any).items.length > 0) return plan;

  const { products } = await computeMonthlyForecast();

  const itemsData = products.map((p) => ({
    productName: p.name,
    category: p.category,
    channel: p.channel,
    marketName: p.marketName,
    recommendedQty: p.nextWeekEstimateQty,
    recommendedKg: p.nextWeekEstimateKg,
    alertStatus: p.status,
    alertReason: reasonFor(p),
  }));

  if (plan) {
    // Empty plan from before real data existed -- backfill it rather than
    // leaving it stuck empty forever.
    await prisma.planItem.createMany({ data: itemsData.map((d) => ({ ...d, planId: plan!.id })) });
  } else {
    plan = await prisma.forecastPlan.create({
      data: { weekStart, items: { create: itemsData } },
      include: { items: { include: { history: { orderBy: { createdAt: "desc" } } } } },
    });
    return plan;
  }

  return prisma.forecastPlan.findUnique({
    where: { id: plan.id },
    include: { items: { include: { history: { orderBy: { createdAt: "desc" } } } } },
  });
}

export async function listPlans() {
  const plans = (await prisma.forecastPlan.findMany({
    orderBy: { weekStart: "desc" },
    include: { items: true },
  })) as any[];
  return plans.map((p: any) => ({
    id: p.id,
    weekStart: p.weekStart,
    status: p.status,
    createdAt: p.createdAt,
    lockedAt: p.lockedAt,
    lockedBy: p.lockedBy,
    itemCount: p.items.length,
    approvedCount: p.items.filter((i: any) => i.decision !== "pending").length,
    alertCount: p.items.filter((i: any) => i.alertStatus !== "ok").length,
    openAlertCount: p.items.filter((i: any) => i.alertStatus !== "ok" && i.decision === "pending").length,
  }));
}

export async function getPlan(planId: string) {
  return prisma.forecastPlan.findUnique({
    where: { id: planId },
    include: { items: { include: { history: { orderBy: { createdAt: "desc" } } } } },
  });
}

export async function approveItem(itemId: string, actor: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id: itemId } });
  const updated = await prisma.planItem.update({
    where: { id: itemId },
    data: {
      decision: "approved",
      approvedQty: item.recommendedQty,
      approvedKg: item.recommendedKg,
      reviewedBy: actor,
      reviewedAt: new Date(),
    },
  });
  await prisma.planItemHistory.create({
    data: {
      planItemId: itemId,
      action: "approved",
      previousQty: item.approvedQty ?? null,
      newQty: item.recommendedQty,
      actor,
    },
  });
  return updated;
}

export async function overrideItem(itemId: string, newQty: number, actor: string, note?: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id: itemId } });
  const weightPerUnit =
    item.recommendedKg && item.recommendedQty ? item.recommendedKg / item.recommendedQty : null;
  const newKg = weightPerUnit ? Math.round(newQty * weightPerUnit * 10) / 10 : null;

  const updated = await prisma.planItem.update({
    where: { id: itemId },
    data: {
      decision: "overridden",
      approvedQty: newQty,
      approvedKg: newKg,
      reviewedBy: actor,
      reviewedAt: new Date(),
    },
  });
  await prisma.planItemHistory.create({
    data: {
      planItemId: itemId,
      action: item.decision === "pending" ? "overridden" : "edited",
      previousQty: item.approvedQty ?? item.recommendedQty,
      newQty,
      actor,
      note,
    },
  });
  return updated;
}

export async function reopenItem(itemId: string, actor: string) {
  const item = await prisma.planItem.findUniqueOrThrow({ where: { id: itemId } });
  const updated = await prisma.planItem.update({
    where: { id: itemId },
    data: { decision: "pending", reviewedBy: null, reviewedAt: null },
  });
  await prisma.planItemHistory.create({
    data: {
      planItemId: itemId,
      action: "reopened",
      previousQty: item.approvedQty,
      newQty: null,
      actor,
    },
  });
  return updated;
}

export async function lockPlan(planId: string, actor: string) {
  return prisma.forecastPlan.update({
    where: { id: planId },
    data: { status: "locked", lockedAt: new Date(), lockedBy: actor },
  });
}

function reasonFor(p: { status: string; growthPct: number }): string | null {
  if (p.status === "declining") return `Sales down ${Math.abs(p.growthPct)}% over the last 4 weeks vs the 4 before.`;
  if (p.status === "high_growth") return `Sales up ${p.growthPct}% -- confirm supply can keep pace.`;
  if (p.status === "low_data") return `Not enough weekly history yet to trust this forecast.`;
  return null;
}
