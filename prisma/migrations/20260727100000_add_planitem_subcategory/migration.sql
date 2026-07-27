-- AlterTable: snapshot subCategory and productCode onto PlanItem, same
-- pattern as the existing category/marketName snapshot fields. Needed for
-- the category/subcategory consolidated rollup view on "This week's plan".
ALTER TABLE "PlanItem" ADD COLUMN "subCategory" TEXT;
ALTER TABLE "PlanItem" ADD COLUMN "productCode" TEXT;
