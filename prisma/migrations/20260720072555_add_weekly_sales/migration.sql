-- CreateTable
CREATE TABLE "WeeklySales" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "plu" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "units" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklySales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklySales_productName_idx" ON "WeeklySales"("productName");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySales_weekStart_plu_key" ON "WeeklySales"("weekStart", "plu");
