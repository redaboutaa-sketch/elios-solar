-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'ON_ORDER', 'OUT_OF_STOCK', 'TO_CONFIRM');

-- CreateEnum
CREATE TYPE "LeadUnit" AS ENUM ('BUSINESS_DAYS', 'CALENDAR_DAYS', 'WEEKS');

-- CreateEnum
CREATE TYPE "GridStatus" AS ENUM ('DRAFT', 'TESTING', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "GridMode" AS ENUM ('TABLE', 'BANDS');

-- CreateEnum
CREATE TYPE "MediaNature" AS ENUM ('PHOTO', 'RENDER', 'ILLUSTRATION', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentAudience" AS ENUM ('PUBLIC', 'CUSTOMER', 'INTERNAL');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'WAITING_CUSTOMER', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CUSTOMER', 'ADVISOR', 'ASSISTANT', 'SYSTEM');

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'INSTALLMENTS_SIM';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "audience" "DocumentAudience" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "groupKey" TEXT NOT NULL DEFAULT md5(random()::text),
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "source" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "summary" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ADD COLUMN     "variantSku" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "externalUrl" TEXT,
ADD COLUMN     "nature" "MediaNature" NOT NULL DEFAULT 'ILLUSTRATION',
ADD COLUMN     "renderConfig" JSONB,
ADD COLUMN     "rightsExpiresAt" TIMESTAMP(3),
ADD COLUMN     "rightsNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "MediaStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "takenAt" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ADD COLUMN     "visibleOptions" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "feesCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "installments" INTEGER,
ADD COLUMN     "method" TEXT NOT NULL DEFAULT 'card',
ADD COLUMN     "planProvider" TEXT;

-- AlterTable
ALTER TABLE "ProductMedia" ADD COLUMN     "context" JSONB,
ADD COLUMN     "finishCode" TEXT,
ADD COLUMN     "mounting" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "variantSku" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "chatEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chatOfflineMessage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "shipmentPolicy" TEXT NOT NULL DEFAULT 'GROUPED';

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'TO_CONFIRM',
ADD COLUMN     "leadMaxDays" INTEGER,
ADD COLUMN     "leadMinDays" INTEGER,
ADD COLUMN     "leadSource" "DataStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "leadUnit" "LeadUnit" NOT NULL DEFAULT 'BUSINESS_DAYS',
ADD COLUMN     "leadUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "partialShipAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "preorderAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preparationDays" INTEGER,
ADD COLUMN     "productionDays" INTEGER,
ADD COLUMN     "stockSource" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "stockUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "supplierDays" INTEGER,
ADD COLUMN     "transportDays" INTEGER,
ADD COLUMN     "validatedAt" TIMESTAMP(3),
ADD COLUMN     "validatedBy" TEXT,
ADD COLUMN     "validationDocumentId" TEXT,
ADD COLUMN     "validationSource" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceGrid" (
    "id" TEXT NOT NULL,
    "familySlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "GridStatus" NOT NULL DEFAULT 'DRAFT',
    "mode" "GridMode" NOT NULL DEFAULT 'TABLE',
    "unit" TEXT NOT NULL DEFAULT 'mm',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT '',
    "widthMinMm" INTEGER NOT NULL,
    "widthMaxMm" INTEGER NOT NULL,
    "widthStepMm" INTEGER NOT NULL DEFAULT 10,
    "lengthMinMm" INTEGER NOT NULL,
    "lengthMaxMm" INTEGER NOT NULL,
    "lengthStepMm" INTEGER NOT NULL DEFAULT 10,
    "heightMinMm" INTEGER NOT NULL,
    "heightMaxMm" INTEGER NOT NULL,
    "heightStepMm" INTEGER NOT NULL DEFAULT 10,
    "mountings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "finishCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "importFilename" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceGrid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceGridCell" (
    "id" TEXT NOT NULL,
    "gridId" TEXT NOT NULL,
    "widthMinMm" INTEGER NOT NULL,
    "widthMaxMm" INTEGER NOT NULL,
    "lengthMinMm" INTEGER NOT NULL,
    "lengthMaxMm" INTEGER NOT NULL,
    "mounting" TEXT NOT NULL DEFAULT '*',
    "finishCode" TEXT NOT NULL DEFAULT '*',
    "priceCents" INTEGER NOT NULL,

    CONSTRAINT "PriceGridCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceGridSurcharge" (
    "id" TEXT NOT NULL,
    "gridId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "match" TEXT NOT NULL DEFAULT '*',
    "thresholdMm" INTEGER,
    "perStepMm" INTEGER,
    "perStepCents" INTEGER,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "percentBps" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PriceGridSurcharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT 'none',
    "enabledTest" BOOLEAN NOT NULL DEFAULT false,
    "enabledProd" BOOLEAN NOT NULL DEFAULT false,
    "merchantEligible" BOOLEAN NOT NULL DEFAULT false,
    "minCents" INTEGER NOT NULL DEFAULT 5000,
    "maxCents" INTEGER NOT NULL DEFAULT 300000,
    "countries" TEXT[] DEFAULT ARRAY['FR']::TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "installmentCounts" INTEGER[] DEFAULT ARRAY[3]::INTEGER[],
    "feesBps" INTEGER NOT NULL DEFAULT 0,
    "feesFixedCents" INTEGER NOT NULL DEFAULT 0,
    "feesLabel" TEXT NOT NULL DEFAULT '',
    "noFeesConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "termsUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "email" TEXT,
    "name" TEXT,
    "subject" TEXT NOT NULL DEFAULT '',
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "configurationId" TEXT,
    "quoteId" TEXT,
    "orderId" TEXT,
    "assignedUserId" TEXT,
    "offline" BOOLEAN NOT NULL DEFAULT false,
    "consentPrivacy" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCustomerReadAt" TIMESTAMP(3),
    "lastAdvisorReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "author" "MessageAuthor" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "PriceGrid_familySlug_status_idx" ON "PriceGrid"("familySlug", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PriceGrid_familySlug_version_key" ON "PriceGrid"("familySlug", "version");

-- CreateIndex
CREATE INDEX "PriceGridCell_gridId_idx" ON "PriceGridCell"("gridId");

-- CreateIndex
CREATE INDEX "PriceGridSurcharge_gridId_idx" ON "PriceGridSurcharge"("gridId");

-- CreateIndex
CREATE INDEX "Conversation_userId_idx" ON "Conversation"("userId");

-- CreateIndex
CREATE INDEX "Conversation_guestKey_idx" ON "Conversation"("guestKey");

-- CreateIndex
CREATE INDEX "Conversation_status_lastMessageAt_idx" ON "Conversation"("status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Document_familyId_status_idx" ON "Document"("familyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Document_groupKey_version_key" ON "Document"("groupKey", "version");

-- CreateIndex
CREATE INDEX "ProductMedia_familyId_sortOrder_idx" ON "ProductMedia"("familyId", "sortOrder");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceGridCell" ADD CONSTRAINT "PriceGridCell_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "PriceGrid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceGridSurcharge" ADD CONSTRAINT "PriceGridSurcharge_gridId_fkey" FOREIGN KEY ("gridId") REFERENCES "PriceGrid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- groupKey : valeur générée côté client (cuid) ; le défaut SQL ne sert qu'aux lignes existantes
ALTER TABLE "Document" ALTER COLUMN "groupKey" DROP DEFAULT;
