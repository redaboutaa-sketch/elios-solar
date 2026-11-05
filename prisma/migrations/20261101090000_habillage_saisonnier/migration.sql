-- Habillage saisonnier léger (désactivé par défaut : thème vide, aucune période)
ALTER TABLE "SiteSettings" ADD COLUMN "seasonalTheme" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SiteSettings" ADD COLUMN "seasonalStartsAt" TIMESTAMP(3);
ALTER TABLE "SiteSettings" ADD COLUMN "seasonalEndsAt" TIMESTAMP(3);
