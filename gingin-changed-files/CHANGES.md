# Changed / new files — Product Code, Subcategory, Qty+Kg for Online

Drop these into your local `gingin-prod` folder, overwriting the existing paths, then commit/push from local (VPS remote is pull-only).

## New files
- `prisma/migrations/20260727050000_add_subcategory/migration.sql`
  Adds `subCategory` column to `OrderItem`. Apply on VPS with `npx prisma migrate deploy`.

## Modified files
- `prisma/schema.prisma`
  Added `subCategory String?` to `OrderItem`.

- `src/lib/dataSource/types.ts`
  Added `subCategory?: string` to `RawOrderRow`.

- `src/lib/dataSource/headerAliases.ts`
  Recognizes a "Subcategory" / "Sub Category" / "Sub-Category" column in source files.

- `src/lib/dataSource/tabularSource.ts`
  Parses the subCategory column from imported rows.

- `src/lib/importOrders.ts`
  Persists `subCategory` onto `OrderItem` when importing.

- `src/lib/monthlyForecast.ts`
  Computes `productCode` (SKU for Online, PLU for Market, falls back to whichever exists)
  and `subCategory` (from OrderItem), and includes both in every product row returned
  to the dashboard.

- `src/lib/columns.ts`
  Added "Product Code" and "Subcategory" as visible dashboard columns, right after Product/Category.

- `src/app/forecast/page.tsx`
  - Added `productCode` / `subCategory` to the `Product` type.
  - Kg-type cells now show **quantity then kg** for Online rows (e.g. "120 qty · 45.2 kg").
    Market rows are unchanged (kg only).
  - CSV export includes Product Code, Subcategory, and quantity columns.
  - Product drawer shows subcategory and product code alongside category.

- `data/required_columns_template.csv`
  Added an example "Subcategory" column so the client knows what header to send.

## Not touched
Market reconciliation (7 markets / 4.5 POS locations) is a client-side process fix,
not a code change — the dashboard's market grouping already works once their
data is reconciled correctly.

## Deploy steps
```powershell
# local (gingin-prod)
npm install
npx prisma generate
npx tsc --noEmit
git add .
git commit -m "Add product code, subcategory columns; qty+kg for online"
git push
```
```bash
# VPS (pull only)
git pull
npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d --build
```
