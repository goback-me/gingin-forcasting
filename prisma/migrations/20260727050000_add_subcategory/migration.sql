-- AlterTable: add subCategory to OrderItem -- nullable, only populated when the
-- source file has a subcategory column (Category/Subcategory requested by client)
ALTER TABLE "OrderItem" ADD COLUMN "subCategory" TEXT;
