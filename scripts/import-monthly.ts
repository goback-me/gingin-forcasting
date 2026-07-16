// Run manually: npm run import:monthly
// Imports the monthly sales report (one sheet per month, e.g. "quarter
// sales") into MonthlySales. Safe to re-run anytime a fresh export lands.
import { importMonthlySales } from "../src/lib/importMonthlySales";

importMonthlySales()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
