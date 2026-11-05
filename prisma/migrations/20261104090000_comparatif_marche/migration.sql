-- CreateEnum
CREATE TYPE "MarketComparability" AS ENUM ('STRONG', 'PARTIAL', 'INSUFFICIENT');

-- CreateEnum
CREATE TYPE "MarketRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "CostPolicyVersion" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "discountBps" INTEGER NOT NULL,
    "eligibility" JSONB NOT NULL DEFAULT '{}',
    "directCosts" JSONB NOT NULL DEFAULT '[]',
    "marginTargetBps" INTEGER,
    "contributionTargetBps" INTEGER,
    "staleDays" INTEGER NOT NULL DEFAULT 120,
    "dimToleranceBps" INTEGER NOT NULL DEFAULT 1000,
    "rounding" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObservation" (
    "id" TEXT NOT NULL,
    "status" "MarketRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "retailer" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'FR',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "familySlug" TEXT NOT NULL,
    "widthMm" INTEGER,
    "depthMm" INTEGER,
    "heightMm" INTEGER,
    "mounting" TEXT NOT NULL DEFAULT 'unknown',
    "roofType" TEXT NOT NULL DEFAULT '',
    "control" TEXT NOT NULL DEFAULT '',
    "options" TEXT NOT NULL DEFAULT '',
    "priceMinor" INTEGER NOT NULL,
    "taxBasis" "TaxBasis" NOT NULL DEFAULT 'UNKNOWN',
    "priceKind" TEXT NOT NULL DEFAULT 'configured',
    "regularPriceMinor" INTEGER,
    "promoPriceMinor" INTEGER,
    "promoEnd" TIMESTAMP(3),
    "scope" JSONB NOT NULL DEFAULT '{}',
    "warranty" TEXT NOT NULL DEFAULT '',
    "material" TEXT NOT NULL DEFAULT '',
    "blades" TEXT NOT NULL DEFAULT '',
    "resistance" TEXT NOT NULL DEFAULT '',
    "sav" TEXT NOT NULL DEFAULT '',
    "comparability" "MarketComparability" NOT NULL DEFAULT 'INSUFFICIENT',
    "comparabilityReason" TEXT NOT NULL DEFAULT '',
    "evidence" TEXT NOT NULL DEFAULT '',
    "access" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketObservationRevision" (
    "id" TEXT NOT NULL,
    "observationId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketObservationRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketPriceProposal" (
    "id" TEXT NOT NULL,
    "status" "MarketRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "familySlug" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT '',
    "config" JSONB NOT NULL,
    "priceListId" TEXT,
    "priceListVersion" INTEGER,
    "policyVersionId" TEXT,
    "currentHtMinor" INTEGER,
    "proposedHtMinor" INTEGER NOT NULL,
    "proposedTtcMinor" INTEGER NOT NULL,
    "scenario" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "justification" TEXT NOT NULL DEFAULT '',
    "gridDraftId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketPriceProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CostPolicyVersion_version_key" ON "CostPolicyVersion"("version");

-- CreateIndex
CREATE INDEX "CostPolicyVersion_validFrom_idx" ON "CostPolicyVersion"("validFrom");

-- CreateIndex
CREATE INDEX "MarketObservation_familySlug_status_idx" ON "MarketObservation"("familySlug", "status");

-- CreateIndex
CREATE INDEX "MarketObservation_observedAt_idx" ON "MarketObservation"("observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketObservationRevision_observationId_revision_key" ON "MarketObservationRevision"("observationId", "revision");

-- CreateIndex
CREATE INDEX "MarketPriceProposal_familySlug_createdAt_idx" ON "MarketPriceProposal"("familySlug", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketObservationRevision" ADD CONSTRAINT "MarketObservationRevision_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "MarketObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

