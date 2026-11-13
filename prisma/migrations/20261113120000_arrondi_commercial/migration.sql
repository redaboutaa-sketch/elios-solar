
-- AlterTable
ALTER TABLE "SupplierPriceList" ADD COLUMN     "saleRounding" TEXT NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "CostPolicyVersion" ADD COLUMN     "saleRounding" TEXT NOT NULL DEFAULT 'NONE';

