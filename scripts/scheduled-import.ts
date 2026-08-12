// Runs all four imports (orders, weekly, monthly, catalog) in sequence,
// straight against the DB -- no HTTP call, no auth needed. Meant to be
// run on a schedule via the VPS's crontab, through the `migrate` Docker
// service (same one used for prisma migrate deploy):
//
//   crontab -e
//   0 6 * * * cd ~/tools/gingin-forcasting && docker compose -f docker-compose.prod.yml run --rm migrate npm run import:scheduled >> /var/log/gingin-import.log 2>&1
//
// IMPORTANT: this only pulls fresh data automatically once SOURCE_REF /
// WEEKLY_SOURCE_REF / MONTHLY_SOURCE_REF / CATALOG_SOURCE_REF are set to a
// live URL (e.g. a Google Sheets "publish to web" link) instead of a local
// file path -- pointed at a local file, this just re-imports the same file
// that's already there. See .env.prod.example for how to set a live URL.
import { importOrders } from "../src/lib/importOrders";
import { importWeeklySales } from "../src/lib/importWeeklySales";
import { importMonthlySales } from "../src/lib/importMonthlySales";
import { importProductCatalog } from "../src/lib/importProductCatalog";

async function main() {
  const results = {
    orders: await importOrders().catch((err) => ({ status: "failed" as const, message: err.message })),
    weekly: await importWeeklySales().catch((err) => ({ status: "failed" as const, message: err.message })),
    monthly: await importMonthlySales().catch((err) => ({ status: "failed" as const, message: err.message })),
    catalog: await importProductCatalog().catch((err) => ({ status: "failed" as const, message: err.message })),
  };
  console.log(JSON.stringify(results, null, 2));
  const anyFailed = Object.values(results).some((r) => r.status === "failed");
  process.exit(anyFailed ? 1 : 0);
}

main();