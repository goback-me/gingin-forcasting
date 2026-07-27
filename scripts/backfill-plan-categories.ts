// Run manually, once, after deploying the category/subcategory work:
//   npx tsx scripts/backfill-plan-categories.ts
//
// Why this is needed: PlanItem snapshots category/subCategory/productCode
// ONCE, at plan-creation time (see getOrCreateCurrentPlan in src/lib/plans.ts).
// It never refreshes automatically -- so a plan created before the
// categorize.ts guesser existed is permanently stuck showing
// "Uncategorised" even though the forecast table right next to it computes
// the real (guessed) category correctly.
//
// This updates category/subCategory/productCode in place on every item in
// every DRAFT plan (never touches locked plans -- those are the permanent
// historical record and shouldn't be rewritten after the fact). It does
// NOT touch decision/approvedQty/approvedKg/history -- any approvals or
// overrides already made are left exactly as they are.
import { prisma } from "../src/lib/db";
import { computeMonthlyForecast } from "../src/lib/monthlyForecast";

async function main() {
  const { products } = await computeMonthlyForecast();
  const byKey = new Map(products.map((p) => [`${p.name}::${p.channel}`, p]));

  const draftPlans = await prisma.forecastPlan.findMany({
    where: { status: "draft" },
    include: { items: true },
  });

  let updated = 0;
  let skipped = 0;

  for (const plan of draftPlans) {
    for (const item of plan.items) {
      const fresh = byKey.get(`${item.productName}::${item.channel}`);
      if (!fresh) {
        skipped++;
        continue;
      }
      await prisma.planItem.update({
        where: { id: item.id },
        data: {
          category: fresh.category,
          subCategory: fresh.subCategory,
          productCode: fresh.productCode,
        },
      });
      updated++;
    }
  }

  console.log(
    `Backfilled category/subCategory/productCode on ${updated} plan item(s) across ${draftPlans.length} draft plan(s). ${skipped} item(s) skipped (no matching product in the current forecast -- likely discontinued).`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });