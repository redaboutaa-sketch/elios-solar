-- Nomenclature du 2026-10-25 : quatre familles (Pergolas, Screens, Stores bannes, Moustiquaires).
--
-- 1. Valeurs d'énumération : catégorie MOUSTIQUAIRES, type de système INSECT_SCREEN_SYSTEM.
-- 2. Renommage des slugs des produits dont la correspondance est ÉTABLIE (même produit) :
--    helio-ombra → helioscreen (R 120 ZiiiP = ex-REFLEKSOL 120 ZiiiP), helio-riviera → casablanca, helio-azur → corsica.
--    Aucun produit n'est recréé : clés primaires, SKU, médias, documents, caractéristiques et relations conservés ;
--    ancien slug ajouté à "legacySlugs" (redirection), ancien nom ajouté à "nameHistory".
--    Mis à jour (références vivantes) : règles, tarifs de pose, promotions, grilles, réalisations, tarifs fournisseur
--    (famille et lignée), validations, guides, configurations enregistrées et lignes de panier.
--    Non modifiés (historique émis) : instantanés des devis, lignes de commande, visuels de devis, e-mails, audit.
-- 3. Modèles retirés (HELIO Horizon / SB 400, HELIO Panorama / SB 500) : archivés, jamais convertis ni supprimés.
--    HELIO Verrière (VERANDA FTS) : archivé (l'offre de screen de toiture est un autre produit).
-- Garde-fou : refus si un ancien et un nouveau slug coexistent.

ALTER TYPE "ProductCategory" ADD VALUE IF NOT EXISTS 'MOUSTIQUAIRES';
ALTER TYPE "FamilyKind" ADD VALUE IF NOT EXISTS 'INSECT_SCREEN_SYSTEM';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductFamily" WHERE slug IN ('helioscreen', 'casablanca', 'corsica')) AND EXISTS (SELECT 1 FROM "ProductFamily" WHERE slug IN ('helio-ombra', 'helio-riviera', 'helio-azur')) THEN
    RAISE EXCEPTION 'Nomenclature 2026-10-25 : un ancien et un nouveau slug coexistent, renommage refusé';
  END IF;
END $$;

-- helio-ombra → helioscreen
UPDATE "ProductFamily" SET slug = 'helioscreen', name = 'HelioScreen', "legacySlugs" = array_append(array_remove("legacySlugs", 'helio-ombra'), 'helio-ombra'), "nameHistory" = "nameHistory" || jsonb_build_array(jsonb_build_object('name', name, 'slug', 'helio-ombra', 'until', '2026-10-25', 'by', 'migration', 'note', 'nomenclature du 2026-10-25')) WHERE slug = 'helio-ombra';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helioscreen' WHERE "closureFamilySlug" = 'helio-ombra';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helioscreen' WHERE "pergolaFamilySlug" = 'helio-ombra';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helioscreen' WHERE "optionFamilySlug" = 'helio-ombra';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helioscreen' WHERE "pergolaFamilySlug" = 'helio-ombra';
UPDATE "InstallationRate" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'helio-ombra', 'helioscreen') WHERE 'helio-ombra' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "Realisation" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "SupplierPriceList" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "SupplierPriceList" SET "sourceKey" = replace("sourceKey", 'grid:helio-ombra:', 'grid:helioscreen:') WHERE "sourceKey" LIKE 'grid:helio-ombra:%';
UPDATE "ReferenceValidation" SET "familySlug" = 'helioscreen' WHERE "familySlug" = 'helio-ombra';
UPDATE "ReferenceValidation" SET "targetId" = 'helioscreen' || substr("targetId", 12) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'helio-ombra#%';
UPDATE "InstallGuideStatus" SET slug = 'helioscreen' || substr(slug, 12) WHERE slug LIKE 'helio-ombra-%' AND NOT EXISTS (SELECT 1 FROM "InstallGuideStatus" g WHERE g.slug = 'helioscreen' || substr("InstallGuideStatus".slug, 12));
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"helio-ombra"', '"helioscreen"')::jsonb WHERE "systemRules"::text LIKE '%"helio-ombra"%';
UPDATE "Configuration" SET input = replace(input::text, '"helio-ombra"', '"helioscreen"')::jsonb WHERE input::text LIKE '%"helio-ombra"%';
UPDATE "Configuration" SET result = replace(result::text, '"helio-ombra"', '"helioscreen"')::jsonb WHERE result::text LIKE '%"helio-ombra"%';
UPDATE "CartLine" SET input = replace(input::text, '"helio-ombra"', '"helioscreen"')::jsonb WHERE input::text LIKE '%"helio-ombra"%';

-- helio-riviera → casablanca
UPDATE "ProductFamily" SET slug = 'casablanca', name = 'Casablanca', "legacySlugs" = array_append(array_remove("legacySlugs", 'helio-riviera'), 'helio-riviera'), "nameHistory" = "nameHistory" || jsonb_build_array(jsonb_build_object('name', name, 'slug', 'helio-riviera', 'until', '2026-10-25', 'by', 'migration', 'note', 'nomenclature du 2026-10-25')) WHERE slug = 'helio-riviera';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'casablanca' WHERE "closureFamilySlug" = 'helio-riviera';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'casablanca' WHERE "pergolaFamilySlug" = 'helio-riviera';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'casablanca' WHERE "optionFamilySlug" = 'helio-riviera';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'casablanca' WHERE "pergolaFamilySlug" = 'helio-riviera';
UPDATE "InstallationRate" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'helio-riviera', 'casablanca') WHERE 'helio-riviera' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "Realisation" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "SupplierPriceRow" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "SupplierPriceList" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "SupplierPriceList" SET "sourceKey" = replace("sourceKey", 'grid:helio-riviera:', 'grid:casablanca:') WHERE "sourceKey" LIKE 'grid:helio-riviera:%';
UPDATE "ReferenceValidation" SET "familySlug" = 'casablanca' WHERE "familySlug" = 'helio-riviera';
UPDATE "ReferenceValidation" SET "targetId" = 'casablanca' || substr("targetId", 14) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'helio-riviera#%';
UPDATE "InstallGuideStatus" SET slug = 'casablanca' || substr(slug, 14) WHERE slug LIKE 'helio-riviera-%' AND NOT EXISTS (SELECT 1 FROM "InstallGuideStatus" g WHERE g.slug = 'casablanca' || substr("InstallGuideStatus".slug, 14));
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"helio-riviera"', '"casablanca"')::jsonb WHERE "systemRules"::text LIKE '%"helio-riviera"%';
UPDATE "Configuration" SET input = replace(input::text, '"helio-riviera"', '"casablanca"')::jsonb WHERE input::text LIKE '%"helio-riviera"%';
UPDATE "Configuration" SET result = replace(result::text, '"helio-riviera"', '"casablanca"')::jsonb WHERE result::text LIKE '%"helio-riviera"%';
UPDATE "CartLine" SET input = replace(input::text, '"helio-riviera"', '"casablanca"')::jsonb WHERE input::text LIKE '%"helio-riviera"%';

-- helio-azur → corsica
UPDATE "ProductFamily" SET slug = 'corsica', name = 'Corsica', "legacySlugs" = array_append(array_remove("legacySlugs", 'helio-azur'), 'helio-azur'), "nameHistory" = "nameHistory" || jsonb_build_array(jsonb_build_object('name', name, 'slug', 'helio-azur', 'until', '2026-10-25', 'by', 'migration', 'note', 'nomenclature du 2026-10-25')) WHERE slug = 'helio-azur';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'corsica' WHERE "closureFamilySlug" = 'helio-azur';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'corsica' WHERE "pergolaFamilySlug" = 'helio-azur';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'corsica' WHERE "optionFamilySlug" = 'helio-azur';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'corsica' WHERE "pergolaFamilySlug" = 'helio-azur';
UPDATE "InstallationRate" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'helio-azur', 'corsica') WHERE 'helio-azur' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "Realisation" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "SupplierPriceRow" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "SupplierPriceList" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "SupplierPriceList" SET "sourceKey" = replace("sourceKey", 'grid:helio-azur:', 'grid:corsica:') WHERE "sourceKey" LIKE 'grid:helio-azur:%';
UPDATE "ReferenceValidation" SET "familySlug" = 'corsica' WHERE "familySlug" = 'helio-azur';
UPDATE "ReferenceValidation" SET "targetId" = 'corsica' || substr("targetId", 11) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'helio-azur#%';
UPDATE "InstallGuideStatus" SET slug = 'corsica' || substr(slug, 11) WHERE slug LIKE 'helio-azur-%' AND NOT EXISTS (SELECT 1 FROM "InstallGuideStatus" g WHERE g.slug = 'corsica' || substr("InstallGuideStatus".slug, 11));
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"helio-azur"', '"corsica"')::jsonb WHERE "systemRules"::text LIKE '%"helio-azur"%';
UPDATE "Configuration" SET input = replace(input::text, '"helio-azur"', '"corsica"')::jsonb WHERE input::text LIKE '%"helio-azur"%';
UPDATE "Configuration" SET result = replace(result::text, '"helio-azur"', '"corsica"')::jsonb WHERE result::text LIKE '%"helio-azur"%';
UPDATE "CartLine" SET input = replace(input::text, '"helio-azur"', '"corsica"')::jsonb WHERE input::text LIKE '%"helio-azur"%';

-- Modèles retirés : archivés (la fiche reste pour l'historique ; aucun devis, projet ou commande n'est modifié)
UPDATE "ProductFamily" SET status = 'ARCHIVED' WHERE slug IN ('helio-horizon', 'helio-panorama', 'helio-verriere');
-- Le niveau « Premium » renvoyait vers helio-azur : les niveaux sont retirés des règles de Casablanca par le seed ;
-- les configurations qui portent encore un "packCode" restent lisibles (champ ignoré sans niveau défini).
