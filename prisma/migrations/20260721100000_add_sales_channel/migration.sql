-- AlterTable: add channel to WeeklySales, defaulting existing + future rows to "Market"
ALTER TABLE "WeeklySales" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'Market';

-- DropIndex: old (weekStart, plu) uniqueness no longer holds once a PLU can
-- have both a Market row and an Online row in the same week
DROP INDEX "WeeklySales_weekStart_plu_key";

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySales_weekStart_plu_channel_key" ON "WeeklySales"("weekStart", "plu", "channel");

-- AlterTable: add channel to PlanItem, defaulting existing + future rows to "Market"
ALTER TABLE "PlanItem" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'Market';

-- DropIndex: old (planId, productName) uniqueness no longer holds once a
-- product can have a separate Market line and Online line in the same plan
DROP INDEX "PlanItem_planId_productName_key";

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planId_productName_channel_key" ON "PlanItem"("planId", "productName", "channel");