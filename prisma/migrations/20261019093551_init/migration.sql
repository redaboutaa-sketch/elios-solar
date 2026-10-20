-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DataStatus" AS ENUM ('DEMO', 'SUPPLIER_VERIFIED', 'OBSERVED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FamilyKind" AS ENUM ('PERGOLA_STANDARD', 'PERGOLA_CUSTOM', 'AWNING', 'SIDE_CLOSURE', 'OPTION', 'SERVICE');

-- CreateEnum
CREATE TYPE "FamilyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'QUOTE_ONLY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Mounting" AS ENUM ('FREESTANDING', 'WALL');

-- CreateEnum
CREATE TYPE "CompatStatus" AS ENUM ('ALLOWED', 'FORBIDDEN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StockMode" AS ENUM ('STOCK', 'MADE_TO_ORDER');

-- CreateEnum
CREATE TYPE "ConfigurationStatus" AS ENUM ('DRAFT', 'VALID', 'NEEDS_REVIEW', 'QUOTE_REQUIRED');

-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('NEW', 'IN_REVIEW', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "FulfillmentStatus" AS ENUM ('UNFULFILLED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DEMO', 'STRIPE');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "phone" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "brandName" TEXT NOT NULL DEFAULT 'ELIOS SOLAR',
    "brandNameProvisional" BOOLEAN NOT NULL DEFAULT true,
    "legalName" TEXT,
    "legalForm" TEXT,
    "siret" TEXT,
    "vatNumber" TEXT,
    "shareCapital" TEXT,
    "rcsCity" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'FR',
    "phone" TEXT,
    "contactEmail" TEXT,
    "domain" TEXT,
    "logoMediaId" TEXT,
    "faviconMediaId" TEXT,
    "defaultTaxRateBps" INTEGER NOT NULL DEFAULT 2000,
    "indexable" BOOLEAN NOT NULL DEFAULT false,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "analyticsScriptUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finish" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "structureColor" TEXT NOT NULL,
    "bladeColor" TEXT NOT NULL,
    "swatch" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Finish_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "DimensionPreset" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "lengthMm" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DimensionPreset_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FamilyKind" NOT NULL,
    "status" "FamilyStatus" NOT NULL DEFAULT 'DRAFT',
    "generation" TEXT,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "roof" TEXT,
    "lightingIncluded" TEXT,
    "accessoryRails" INTEGER,
    "dividerThresholdMm" INTEGER,
    "mountings" "Mounting"[],
    "specs" JSONB NOT NULL DEFAULT '[]',
    "faq" JSONB NOT NULL DEFAULT '[]',
    "included" JSONB NOT NULL DEFAULT '[]',
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFinish" (
    "familyId" TEXT NOT NULL,
    "finishCode" TEXT NOT NULL,

    CONSTRAINT "FamilyFinish_pkey" PRIMARY KEY ("familyId","finishCode")
);

-- CreateTable
CREATE TABLE "FamilyDimension" (
    "familyId" TEXT NOT NULL,
    "dimensionCode" TEXT NOT NULL,

    CONSTRAINT "FamilyDimension_pkey" PRIMARY KEY ("familyId","dimensionCode")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "compareAtCents" INTEGER,
    "taxRateBps" INTEGER NOT NULL DEFAULT 2000,
    "purchasable" BOOLEAN NOT NULL DEFAULT false,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "stockMode" "StockMode" NOT NULL DEFAULT 'MADE_TO_ORDER',
    "stockQty" INTEGER,
    "leadTimeDays" INTEGER,
    "weightGrams" INTEGER,
    "attributes" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureCompatRule" (
    "id" TEXT NOT NULL,
    "closureFamilySlug" TEXT NOT NULL,
    "pergolaFamilySlug" TEXT NOT NULL DEFAULT '*',
    "segmentLengthMm" INTEGER,
    "pergolaFinishCode" TEXT NOT NULL DEFAULT '*',
    "mounting" TEXT NOT NULL DEFAULT '*',
    "status" "CompatStatus" NOT NULL,
    "reason" TEXT,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosureCompatRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionCompatRule" (
    "id" TEXT NOT NULL,
    "optionFamilySlug" TEXT NOT NULL,
    "pergolaFamilySlug" TEXT NOT NULL DEFAULT '*',
    "status" "CompatStatus" NOT NULL,
    "includedInBase" BOOLEAN NOT NULL DEFAULT false,
    "maxQty" INTEGER,
    "reason" TEXT,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptionCompatRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallationRate" (
    "id" TEXT NOT NULL,
    "familySlug" TEXT NOT NULL,
    "dimensionCode" TEXT,
    "priceCents" INTEGER NOT NULL,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'DEMO',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShippingRule" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'FR',
    "postalPrefixes" TEXT[],
    "priceCents" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "quoteRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "familySlugs" TEXT[],
    "allFamilies" BOOLEAN NOT NULL DEFAULT false,
    "percentBps" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomPergolaSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "quoteOnly" BOOLEAN NOT NULL DEFAULT true,
    "widthMinMm" INTEGER NOT NULL DEFAULT 2000,
    "widthMaxMm" INTEGER NOT NULL DEFAULT 4000,
    "widthStepMm" INTEGER NOT NULL DEFAULT 10,
    "lengthMinMm" INTEGER NOT NULL DEFAULT 2000,
    "lengthMaxMm" INTEGER NOT NULL DEFAULT 6000,
    "lengthStepMm" INTEGER NOT NULL DEFAULT 10,
    "heightMinMm" INTEGER NOT NULL DEFAULT 2200,
    "heightMaxMm" INTEGER NOT NULL DEFAULT 3000,
    "heightStepMm" INTEGER NOT NULL DEFAULT 10,
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'UNKNOWN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomPergolaSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'image',
    "path" TEXT NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "source" TEXT NOT NULL DEFAULT '',
    "license" TEXT NOT NULL DEFAULT '',
    "credit" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'gallery',
    "caption" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "familyId" TEXT,
    "mediaId" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'notice',
    "dataStatus" "DataStatus" NOT NULL DEFAULT 'UNKNOWN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "shareToken" TEXT NOT NULL,
    "shareRevoked" BOOLEAN NOT NULL DEFAULT false,
    "ownerUserId" TEXT,
    "guestKey" TEXT,
    "kind" TEXT NOT NULL,
    "title" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "engineVersion" TEXT NOT NULL,
    "catalogVersion" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "status" "ConfigurationStatus" NOT NULL DEFAULT 'DRAFT',
    "parentId" TEXT,
    "lastValidatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "promotionCode" TEXT,
    "delivery" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "configurationId" TEXT,
    "input" JSONB NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "company" TEXT,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'FR',
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "postalCode" TEXT,
    "message" TEXT,
    "kind" TEXT NOT NULL,
    "configurationId" TEXT,
    "snapshot" JSONB NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'NEW',
    "validUntil" TIMESTAMP(3),
    "adminNotes" TEXT,
    "proposedTotalCents" INTEGER,
    "containsDemoData" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT,
    "guestKey" TEXT,
    "email" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "fulfillmentStatus" "FulfillmentStatus" NOT NULL DEFAULT 'UNFULFILLED',
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "goodsCents" INTEGER NOT NULL,
    "installationCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "billingAddress" JSONB NOT NULL,
    "delivery" JSONB NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "containsDemoData" BOOLEAN NOT NULL DEFAULT true,
    "customerNotes" TEXT,
    "adminNotes" TEXT,
    "cartId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sku" TEXT,
    "label" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitGrossCents" INTEGER NOT NULL,
    "totalGrossCents" INTEGER NOT NULL,
    "taxRateBps" INTEGER NOT NULL,
    "included" BOOLEAN NOT NULL DEFAULT false,
    "configurationSnapshot" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "providerRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "checkoutUrl" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "provider" "PaymentProvider" NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockReservation" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "orderId" TEXT,
    "qty" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'contact',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "preferredSlot" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" TEXT NOT NULL,
    "guestKey" TEXT,
    "userId" TEXT,
    "necessary" BOOLEAN NOT NULL DEFAULT true,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "version" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "missingFields" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Realisation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT,
    "familySlug" TEXT,
    "mediaId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Realisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Showroom" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "hours" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "isDemo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Showroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogImport" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PREVIEW',
    "summary" JSONB NOT NULL,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_slug_key" ON "ProductFamily"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_sku_key" ON "Variant"("sku");

-- CreateIndex
CREATE INDEX "Variant_familyId_idx" ON "Variant"("familyId");

-- CreateIndex
CREATE INDEX "ClosureCompatRule_closureFamilySlug_pergolaFamilySlug_idx" ON "ClosureCompatRule"("closureFamilySlug", "pergolaFamilySlug");

-- CreateIndex
CREATE UNIQUE INDEX "OptionCompatRule_optionFamilySlug_pergolaFamilySlug_key" ON "OptionCompatRule"("optionFamilySlug", "pergolaFamilySlug");

-- CreateIndex
CREATE INDEX "InstallationRate_familySlug_idx" ON "InstallationRate"("familySlug");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_shareToken_key" ON "Configuration"("shareToken");

-- CreateIndex
CREATE INDEX "Configuration_ownerUserId_idx" ON "Configuration"("ownerUserId");

-- CreateIndex
CREATE INDEX "Configuration_guestKey_idx" ON "Configuration"("guestKey");

-- CreateIndex
CREATE INDEX "Cart_userId_idx" ON "Cart"("userId");

-- CreateIndex
CREATE INDEX "Cart_guestKey_idx" ON "Cart"("guestKey");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_number_key" ON "Quote"("number");

-- CreateIndex
CREATE INDEX "Quote_userId_idx" ON "Quote"("userId");

-- CreateIndex
CREATE INDEX "Quote_email_idx" ON "Quote"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_email_idx" ON "Order"("email");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_eventId_key" ON "PaymentEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "StockReservation_variantId_status_idx" ON "StockReservation"("variantId", "status");

-- CreateIndex
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_nextAttemptAt_idx" ON "EmailOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "Consent_guestKey_idx" ON "Consent"("guestKey");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentPage_slug_key" ON "ContentPage"("slug");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFinish" ADD CONSTRAINT "FamilyFinish_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFinish" ADD CONSTRAINT "FamilyFinish_finishCode_fkey" FOREIGN KEY ("finishCode") REFERENCES "Finish"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDimension" ADD CONSTRAINT "FamilyDimension_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyDimension" ADD CONSTRAINT "FamilyDimension_dimensionCode_fkey" FOREIGN KEY ("dimensionCode") REFERENCES "DimensionPreset"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockReservation" ADD CONSTRAINT "StockReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Realisation" ADD CONSTRAINT "Realisation_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
