// Run manually: npm run import
// Or on a schedule once SOURCE_REF points at a live Google Sheet, e.g. via
// system crontab: 0 6 * * * cd /path/to/app && npm run import >> import.log 2>&1
import { importOrders } from "../src/lib/importOrders";

importOrders()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
