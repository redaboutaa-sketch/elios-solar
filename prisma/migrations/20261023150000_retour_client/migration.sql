-- Retour client du 2026-10-21 : séparation identifiant / référence fournisseur / nom commercial / slug / historique,
-- ensembles « Réalisations » et « Production », statut de validation des guides d'installation.

-- AlterTable
ALTER TABLE "ProductFamily" ADD COLUMN     "commercialEditedAt" TIMESTAMP(3),
ADD COLUMN     "legacySlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nameHistory" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Realisation" ADD COLUMN     "caption" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'REALISATION',
ADD COLUMN     "partnerNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "placeholder" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "InstallGuideStatus" (
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validatedBy" TEXT,
    "validatedAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallGuideStatus_pkey" PRIMARY KEY ("slug")
);


-- Historique de la nomenclature commerciale du 2026-10-22 (anciens slugs et anciens noms publics). Idempotent :
-- seules les familles sans historique sont renseignées.
UPDATE "ProductFamily" f SET "legacySlugs" = ARRAY[h.old_slug], "nameHistory" = jsonb_build_array(jsonb_build_object('name', h.old_name, 'slug', h.old_slug, 'until', '2026-10-22', 'by', 'migration', 'note', 'nomenclature commerciale HELIOSTORES'))
FROM (VALUES
  ('helio-horizon', 'pergola-sb400', 'Pergola SB400'),
  ('helio-panorama', 'pergola-sb500', 'Pergola SB500'),
  ('helio-ombra', 'screen-refleksol-120-ziiip', 'Screen REFLEKSOL 120 ZiiiP'),
  ('helio-riviera', 'store-banne-casablanca', 'Store banne CASABLANCA'),
  ('helio-verriere', 'veranda-fts', 'Store de véranda VERANDA FTS')
) AS h(slug, old_slug, old_name)
WHERE f.slug = h.slug AND f."nameHistory" = '[]'::jsonb;
