-- Page Références (2026-10-25) : crédit, autorisation de publication et localisation publiable des réalisations et
-- photographies de production. Aucune donnée existante n'est modifiée.
ALTER TABLE "Realisation" ADD COLUMN "locationPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Realisation" ADD COLUMN "credit" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Realisation" ADD COLUMN "authorization" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Realisation" ADD COLUMN "authorizedAt" TIMESTAMP(3);
