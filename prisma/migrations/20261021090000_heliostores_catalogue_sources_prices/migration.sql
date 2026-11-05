-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('PERGOLAS', 'SCREENS', 'STORES_BANNES');

-- CreateEnum
CREATE TYPE "PriceNature" AS ENUM ('UNKNOWN', 'PURCHASE', 'SALE', 'RECOMMENDED', 'EXAMPLE');

-- CreateEnum
CREATE TYPE "TaxBasis" AS ENUM ('UNKNOWN', 'HT', 'TTC');

-- CreateEnum
CREATE TYPE "PriceListStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PriceRowStatus" AS ENUM ('OK', 'TO_CHECK', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FamilyKind" ADD VALUE 'PERGOLA_SYSTEM';
ALTER TYPE "FamilyKind" ADD VALUE 'SCREEN_SYSTEM';
ALTER TYPE "FamilyKind" ADD VALUE 'AWNING_SYSTEM';
ALTER TYPE "FamilyKind" ADD VALUE 'ROOF_BLIND_SYSTEM';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SpecSource" ADD VALUE 'CLIENT_SHEET';
ALTER TYPE "SpecSource" ADD VALUE 'SUPPLIER_DOCUMENT';
ALTER TYPE "SpecSource" ADD VALUE 'MANUFACTURER_WEBSITE';

-- AlterTable
ALTER TABLE "ContactRequest" ADD COLUMN     "attribution" JSONB;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "provenance" JSONB;

-- AlterTable
ALTER TABLE "ProductFamily" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "category" "ProductCategory",
ADD COLUMN     "legacy" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "openQuestions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "supplierRef" TEXT,
ADD COLUMN     "systemRules" JSONB;

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "attribution" JSONB,
ADD COLUMN     "qualification" TEXT NOT NULL DEFAULT 'TO_QUALIFY';

-- CreateTable
CREATE TABLE "SupplierPriceList" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "sourceFile" TEXT NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "status" "PriceListStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT,
    "currencyNote" TEXT NOT NULL DEFAULT '',
    "taxBasis" "TaxBasis" NOT NULL DEFAULT 'UNKNOWN',
    "nature" "PriceNature" NOT NULL DEFAULT 'UNKNOWN',
    "natureNote" TEXT NOT NULL DEFAULT '',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "report" JSONB NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "importedBy" TEXT,
    "activatedBy" TEXT,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierPriceList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPriceRow" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "familySlug" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'GRID',
    "code" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "dimAKey" TEXT,
    "dimAmm" INTEGER,
    "widthMinMm" INTEGER,
    "widthMaxMm" INTEGER,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "amountMinor" INTEGER,
    "currency" TEXT,
    "amountRole" TEXT NOT NULL,
    "formula" TEXT,
    "cachedValue" DOUBLE PRECISION,
    "sourceRef" TEXT NOT NULL,
    "status" "PriceRowStatus" NOT NULL DEFAULT 'TO_CHECK',
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPriceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierPriceList_sourceKey_status_idx" ON "SupplierPriceList"("sourceKey", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPriceList_sourceKey_version_key" ON "SupplierPriceList"("sourceKey", "version");

-- CreateIndex
CREATE INDEX "SupplierPriceRow_listId_familySlug_idx" ON "SupplierPriceRow"("listId", "familySlug");

-- AddForeignKey
ALTER TABLE "SupplierPriceRow" ADD CONSTRAINT "SupplierPriceRow_listId_fkey" FOREIGN KEY ("listId") REFERENCES "SupplierPriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

