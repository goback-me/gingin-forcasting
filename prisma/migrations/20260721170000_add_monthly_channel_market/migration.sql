-- AlterTable: add channel to MonthlySales, defaulting existing + future rows to "Market"
ALTER TABLE "MonthlySales" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'Market';

-- AlterTable: add marketName to MonthlySales -- nullable, only set for Market-channel rows
ALTER TABLE "MonthlySales" ADD COLUMN "marketName" TEXT;

-- DropIndex: old (month, productName) uniqueness no longer holds once a
-- product can have a separate Market row and Online row in the same month
DROP INDEX "MonthlySales_month_productName_key";

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySales_month_productName_channel_key" ON "MonthlySales"("month", "productName", "channel");
