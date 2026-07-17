-- CreateTable
CREATE TABLE "ForecastPlan" (
    "id" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,

    CONSTRAINT "ForecastPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "recommendedQty" INTEGER NOT NULL,
    "recommendedKg" DOUBLE PRECISION,
    "approvedQty" INTEGER,
    "approvedKg" DOUBLE PRECISION,
    "decision" TEXT NOT NULL DEFAULT 'pending',
    "alertStatus" TEXT NOT NULL,
    "alertReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItemHistory" (
    "id" TEXT NOT NULL,
    "planItemId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousQty" INTEGER,
    "newQty" INTEGER,
    "actor" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanItemHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySales" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "monthLabel" TEXT NOT NULL,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "itemsSold" INTEGER NOT NULL,
    "revenue" DOUBLE PRECISION,
    "orders" INTEGER,
    "variations" INTEGER,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "weightG" DOUBLE PRECISION,
    "itemCost" DOUBLE PRECISION,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardColumn" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardColumn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportLog" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "rowCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ForecastPlan_weekStart_key" ON "ForecastPlan"("weekStart");

-- CreateIndex
CREATE INDEX "PlanItem_productName_idx" ON "PlanItem"("productName");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planId_productName_key" ON "PlanItem"("planId", "productName");

-- CreateIndex
CREATE INDEX "PlanItemHistory_planItemId_idx" ON "PlanItemHistory"("planItemId");

-- CreateIndex
CREATE INDEX "MonthlySales_productName_idx" ON "MonthlySales"("productName");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySales_month_productName_key" ON "MonthlySales"("month", "productName");

-- CreateIndex
CREATE UNIQUE INDEX "Order_externalId_key" ON "Order"("externalId");

-- CreateIndex
CREATE INDEX "Order_orderDate_idx" ON "Order"("orderDate");

-- CreateIndex
CREATE INDEX "OrderItem_productName_idx" ON "OrderItem"("productName");

-- CreateIndex
CREATE INDEX "OrderItem_sku_idx" ON "OrderItem"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardColumn_key_key" ON "DashboardColumn"("key");

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ForecastPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItemHistory" ADD CONSTRAINT "PlanItemHistory_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "PlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
