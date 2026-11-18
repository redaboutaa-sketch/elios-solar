-- Paiements (2026-10-25) : virement en attente de fonds puis rapproché, virement partiel, compte et environnement du
-- prestataire, paiement à examiner (fonds reçus après expiration), commande issue d'un devis approuvé.
ALTER TABLE "Order" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "Order" ADD COLUMN "paymentReview" TEXT;
CREATE INDEX "Order_quoteId_idx" ON "Order"("quoteId");
ALTER TABLE "Payment" ADD COLUMN "awaitingFundsSince" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "instructionsUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "amountReceivedCents" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "providerAccount" TEXT;
ALTER TABLE "Payment" ADD COLUMN "livemode" BOOLEAN;
