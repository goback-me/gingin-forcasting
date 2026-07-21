-- AlterTable: add marketName to WeeklySales -- nullable, only set for Market-channel rows
ALTER TABLE "WeeklySales" ADD COLUMN "marketName" TEXT;

-- AlterTable: add marketName to PlanItem -- nullable, snapshotted from the forecast, only set for Market-channel lines
ALTER TABLE "PlanItem" ADD COLUMN "marketName" TEXT;
