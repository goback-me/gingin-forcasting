// Run manually: npm run import:catalog
// Imports the product master catalog (category/subcategory enrichment
// source, matched by product name) -- NOT sales data, so it never touches
// WeeklySales/MonthlySales/OrderItem. Safe to re-run anytime an updated
// export lands.
import { importProductCatalog } from "../src/lib/importProductCatalog";

importProductCatalog()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });