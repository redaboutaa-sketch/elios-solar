-- Administration des tarifs : grilles tarifaires versionnées (SupplierPriceList scope GRID), provenance des cellules,
-- téléversements privés. Aucune donnée n'est modifiée ici : les grilles sont créées par `pnpm tariffs:init` (appelé par le seed),
-- à partir de l'import existant du classeur.

-- CreateEnum
CREATE TYPE "PriceListScope" AS ENUM ('IMPORT', 'GRID');

-- CreateEnum
CREATE TYPE "PriceClientele" AS ENUM ('ALL', 'PARTICULIER', 'PROFESSIONNEL');

-- CreateEnum
CREATE TYPE "GridDimRule" AS ENUM ('EXACT', 'ROUND_UP');

-- AlterEnum
ALTER TYPE "PriceListStatus" ADD VALUE 'VERIFIED';

-- AlterTable
ALTER TABLE "SupplierPriceList" ADD COLUMN     "amountRole" TEXT,
ADD COLUMN     "baseActiveId" TEXT,
ADD COLUMN     "basedOnId" TEXT,
ADD COLUMN     "clientele" "PriceClientele" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "deactivatedBy" TEXT,
ADD COLUMN     "dimRule" "GridDimRule" NOT NULL DEFAULT 'EXACT',
ADD COLUMN     "dimRuleNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "excluded" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "familySlug" TEXT,
ADD COLUMN     "included" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "originListId" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedBy" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scope" "PriceListScope" NOT NULL DEFAULT 'IMPORT',
ADD COLUMN     "scopeNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "variantKey" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "vatRateBps" INTEGER,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedBy" TEXT,
ADD COLUMN     "zeroConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupplierPriceRow" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedBy" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'IMPORT';

-- CreateTable
CREATE TABLE "PriceImportUpload" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANALYSED',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mapping" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB NOT NULL DEFAULT '{}',
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "PriceImportUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceImportFile" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA,

    CONSTRAINT "PriceImportFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PriceImportFile_uploadId_idx" ON "PriceImportFile"("uploadId");

-- CreateIndex
CREATE INDEX "SupplierPriceList_scope_familySlug_status_idx" ON "SupplierPriceList"("scope", "familySlug", "status");

-- AddForeignKey
ALTER TABLE "PriceImportFile" ADD CONSTRAINT "PriceImportFile_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "PriceImportUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

