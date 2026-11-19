-- Benchmark marché : niveaux de comparabilité A/B/C/D, preuve et périmètre détaillés (ajouts seulement).
CREATE TYPE "MarketMatchLevel" AS ENUM ('A', 'B', 'C', 'D');

ALTER TABLE "MarketObservation"
  ADD COLUMN "matchLevel" "MarketMatchLevel",
  ADD COLUMN "matchReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "supplierSystem" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sellerGroup" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "language" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "collectionMethod" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "controlKind" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN "promoConditions" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "specs" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "differences" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "unknownFields" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "deliversTo" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "fx" JSONB,
  ADD COLUMN "capture" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "validation" TEXT NOT NULL DEFAULT 'TO_VALIDATE',
  ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
