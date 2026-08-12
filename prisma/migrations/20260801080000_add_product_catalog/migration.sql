-- CreateTable: ProductCatalog -- master product data (category/subcategory
-- enrichment source), matched against sales rows by product name.
CREATE TABLE "ProductCatalog" (
    "id" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "parentCode" TEXT,
    "description" TEXT NOT NULL,
    "generalStatement" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "productLocation" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductCatalog_productCode_key" ON "ProductCatalog"("productCode");
CREATE INDEX "ProductCatalog_description_idx" ON "ProductCatalog"("description");
