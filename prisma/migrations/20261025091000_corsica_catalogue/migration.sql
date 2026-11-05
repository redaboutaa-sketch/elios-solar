-- Nomenclature du 2026-10-25 : Corsica fait partie des quatre stores bannes retenus par le client (nom conservé).
-- L'ancien niveau « Premium » (HELIO Azur) était en brouillon : il passe sur devis, sans prix (aucune grille Corsica).
UPDATE "ProductFamily" SET status = 'QUOTE_ONLY' WHERE slug = 'corsica' AND status = 'DRAFT';
