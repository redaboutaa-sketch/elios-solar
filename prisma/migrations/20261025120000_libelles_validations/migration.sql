-- Nomenclature du 2026-10-25 : libellés des dossiers de validation des produits renommés (même produit).
-- Les décisions, notes et historiques restent inchangés ; seuls les libellés d'affichage suivent le nom actuel.
UPDATE "ReferenceValidation" SET "targetLabel" = replace(replace(replace("targetLabel", 'HELIO Ombra', 'HelioScreen'), 'HELIO Riviera', 'Casablanca'), 'HELIO Azur', 'Corsica')
WHERE "targetLabel" ~ 'HELIO (Ombra|Riviera|Azur)';
