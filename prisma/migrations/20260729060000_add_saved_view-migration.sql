-- CreateTable: SavedView -- custom report builder views (columns/filters/sort
-- saved as JSON), created/loaded/deleted from the /reports page.
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "sortKey" TEXT,
    "sortDir" INTEGER NOT NULL DEFAULT -1,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SavedView_name_key" ON "SavedView"("name");
