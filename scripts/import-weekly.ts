// Run manually: npm run import:weekly
import { importWeeklySales } from "../src/lib/importWeeklySales";

importWeeklySales()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
