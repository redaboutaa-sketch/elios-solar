-- Issue commerciale d'un devis réglé hors ligne : montant HT réellement encaissé, date, motif de gain ou de perte.
-- Colonnes facultatives ajoutées sans valeur par défaut : l'historique reste « non renseigné ».
ALTER TABLE "Quote" ADD COLUMN "cashedNetCents" INTEGER;
ALTER TABLE "Quote" ADD COLUMN "cashedAt" TIMESTAMP(3);
ALTER TABLE "Quote" ADD COLUMN "outcomeNote" TEXT;
