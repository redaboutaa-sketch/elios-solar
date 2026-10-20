-- CreateEnum
CREATE TYPE "SpecSource" AS ENUM ('DEMO_SEED', 'OBSERVED_REFERENCE', 'SUPPLIER_CONFIRMED');

-- CreateEnum
CREATE TYPE "ValidationTarget" AS ENUM ('VARIANT', 'FAMILY_SPEC', 'CLOSURE_RULE', 'OPTION_RULE');

-- CreateEnum
CREATE TYPE "ValidationStatus" AS ENUM ('DRAFT', 'TO_REVIEW', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ValidationSourceKind" AS ENUM ('SUPPLIER_DOCUMENT', 'SUPPLIER_WRITTEN', 'OBSERVED_REFERENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisualKind" AS ENUM ('SCENE_3D', 'PLAN_2D');


-- CreateTable
CREATE TABLE "TechnicalSpec" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "variantSku" TEXT,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "valueNum" INTEGER,
    "unit" TEXT,
    "valueText" TEXT,
    "source" "SpecSource" NOT NULL,
    "sourceRef" TEXT NOT NULL DEFAULT '',
    "documentId" TEXT,
    "observedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TechnicalSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceValidation" (
    "id" TEXT NOT NULL,
    "targetType" "ValidationTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetLabel" TEXT NOT NULL,
    "familySlug" TEXT,
    "baseData" JSONB NOT NULL,
    "baseHash" TEXT NOT NULL,
    "proposed" JSONB NOT NULL,
    "sourceKind" "ValidationSourceKind",
    "sourceUrl" TEXT,
    "documentId" TEXT,
    "sourceNote" TEXT NOT NULL DEFAULT '',
    "status" "ValidationStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "appliedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceValidationEvent" (
    "id" TEXT NOT NULL,
    "validationId" TEXT NOT NULL,
    "fromStatus" "ValidationStatus",
    "toStatus" "ValidationStatus" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "note" TEXT,
    "dataHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferenceValidationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVisual" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "configurationId" TEXT,
    "configurationVersion" INTEGER,
    "inputHash" TEXT NOT NULL,
    "kind" "VisualKind" NOT NULL DEFAULT 'SCENE_3D',
    "storageKey" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "represented" JSONB NOT NULL DEFAULT '[]',
    "disclaimer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteVisual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TechnicalSpec_familyId_key_idx" ON "TechnicalSpec"("familyId", "key");

-- CreateIndex
CREATE INDEX "ReferenceValidation_targetType_targetId_idx" ON "ReferenceValidation"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ReferenceValidation_status_idx" ON "ReferenceValidation"("status");

-- CreateIndex
CREATE INDEX "ReferenceValidationEvent_validationId_idx" ON "ReferenceValidationEvent"("validationId");

-- CreateIndex
CREATE INDEX "QuoteVisual_quoteId_idx" ON "QuoteVisual"("quoteId");

-- AddForeignKey
ALTER TABLE "TechnicalSpec" ADD CONSTRAINT "TechnicalSpec_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TechnicalSpec" ADD CONSTRAINT "TechnicalSpec_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceValidation" ADD CONSTRAINT "ReferenceValidation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceValidation" ADD CONSTRAINT "ReferenceValidation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceValidation" ADD CONSTRAINT "ReferenceValidation_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceValidationEvent" ADD CONSTRAINT "ReferenceValidationEvent_validationId_fkey" FOREIGN KEY ("validationId") REFERENCES "ReferenceValidation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVisual" ADD CONSTRAINT "QuoteVisual_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVisual" ADD CONSTRAINT "QuoteVisual_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Conversion : l'ancienne longueur de câble (valeur fictive du seed) devient une donnée technique
-- explicitement marquée DEMO_SEED, jamais présentée comme certaine.
INSERT INTO "TechnicalSpec" ("id", "familyId", "key", "label", "valueNum", "unit", "source", "sourceRef", "note", "updatedAt")
SELECT 'spec_cable_demo_' || "id", "id", 'included_cable_length', 'Longueur du câble d''alimentation fourni', "includedCableMm", 'mm', 'DEMO_SEED',
       'valeur fictive du jeu de démonstration (ancienne colonne ProductFamily.includedCableMm)', 'Ne pas publier : non issue d''une source.', CURRENT_TIMESTAMP
FROM "ProductFamily" WHERE "includedCableMm" IS NOT NULL;

ALTER TABLE "ProductFamily" DROP COLUMN "includedCableMm";
