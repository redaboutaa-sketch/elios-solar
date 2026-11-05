-- Nomenclature commerciale HELIOSTORES (suite) : libellé des dossiers de validation ouverts sur une donnée technique.
-- Le libellé « <nom> — <caractéristique> » est figé à la création du dossier ; seul le préfixe du nom change.
-- Les événements de validation (historique) ne sont pas modifiés.

UPDATE "ReferenceValidation" SET "targetLabel" = 'HELIO Horizon' || substr("targetLabel", 14) WHERE "targetType" = 'FAMILY_SPEC' AND "familySlug" = 'helio-horizon' AND "targetLabel" LIKE 'Pergola SB400 — %';
UPDATE "ReferenceValidation" SET "targetLabel" = 'HELIO Panorama' || substr("targetLabel", 14) WHERE "targetType" = 'FAMILY_SPEC' AND "familySlug" = 'helio-panorama' AND "targetLabel" LIKE 'Pergola SB500 — %';
UPDATE "ReferenceValidation" SET "targetLabel" = 'HELIO Ombra' || substr("targetLabel", 27) WHERE "targetType" = 'FAMILY_SPEC' AND "familySlug" = 'helio-ombra' AND "targetLabel" LIKE 'Screen REFLEKSOL 120 ZiiiP — %';
UPDATE "ReferenceValidation" SET "targetLabel" = 'HELIO Riviera' || substr("targetLabel", 23) WHERE "targetType" = 'FAMILY_SPEC' AND "familySlug" = 'helio-riviera' AND "targetLabel" LIKE 'Store banne CASABLANCA — %';
UPDATE "ReferenceValidation" SET "targetLabel" = 'HELIO Verrière' || substr("targetLabel", 29) WHERE "targetType" = 'FAMILY_SPEC' AND "familySlug" = 'helio-verriere' AND "targetLabel" LIKE 'Store de véranda VERANDA FTS — %';
