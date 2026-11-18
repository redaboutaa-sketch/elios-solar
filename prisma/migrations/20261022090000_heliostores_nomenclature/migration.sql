-- Nomenclature commerciale HELIOSTORES (décision client du 2026-10-22).
--
-- Renomme le slug public des cinq produits HELIOSTORES (références fournisseur → noms commerciaux) et les codes de
-- commande dont l'identifiant reprenait un modèle de moteur. Aucun produit n'est recréé : les clés primaires, les
-- SKU, les médias, documents, caractéristiques et relations par clé étrangère sont conservés.
--
-- Mis à jour (références vivantes) : familles, règles de compatibilité, tarifs de pose, promotions, grilles,
-- réalisations, lignes de tarif fournisseur, cibles de validation, configurations enregistrées et lignes de panier.
-- Non modifiés (historique émis) : instantanés des devis, lignes de commande, visuels de devis, e-mails, journaux
-- d'audit et événements de validation. Les anciennes URL sont redirigées (next.config.ts, legacy-slugs.ts).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ProductFamily" WHERE slug IN ('helio-horizon', 'helio-panorama', 'helio-ombra', 'helio-riviera', 'helio-verriere')) AND EXISTS (SELECT 1 FROM "ProductFamily" WHERE slug IN ('pergola-sb400', 'pergola-sb500', 'screen-refleksol-120-ziiip', 'store-banne-casablanca', 'veranda-fts')) THEN
    RAISE EXCEPTION 'Nomenclature : un ancien et un nouveau slug coexistent, renommage refusé';
  END IF;
END $$;

-- pergola-sb400 → helio-horizon
UPDATE "ProductFamily" SET slug = 'helio-horizon' WHERE slug = 'pergola-sb400';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helio-horizon' WHERE "closureFamilySlug" = 'pergola-sb400';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helio-horizon' WHERE "pergolaFamilySlug" = 'pergola-sb400';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helio-horizon' WHERE "optionFamilySlug" = 'pergola-sb400';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helio-horizon' WHERE "pergolaFamilySlug" = 'pergola-sb400';
UPDATE "InstallationRate" SET "familySlug" = 'helio-horizon' WHERE "familySlug" = 'pergola-sb400';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'pergola-sb400', 'helio-horizon') WHERE 'pergola-sb400' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helio-horizon' WHERE "familySlug" = 'pergola-sb400';
UPDATE "Realisation" SET "familySlug" = 'helio-horizon' WHERE "familySlug" = 'pergola-sb400';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helio-horizon' WHERE "familySlug" = 'pergola-sb400';
UPDATE "ReferenceValidation" SET "familySlug" = 'helio-horizon' WHERE "familySlug" = 'pergola-sb400';
UPDATE "ReferenceValidation" SET "targetId" = 'helio-horizon' || substr("targetId", 14) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'pergola-sb400#%';
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"pergola-sb400"', '"helio-horizon"')::jsonb WHERE "systemRules"::text LIKE '%"pergola-sb400"%';
UPDATE "Configuration" SET input = replace(input::text, '"pergola-sb400"', '"helio-horizon"')::jsonb WHERE input::text LIKE '%"pergola-sb400"%';
UPDATE "Configuration" SET result = replace(result::text, '"pergola-sb400"', '"helio-horizon"')::jsonb WHERE result::text LIKE '%"pergola-sb400"%';
UPDATE "CartLine" SET input = replace(input::text, '"pergola-sb400"', '"helio-horizon"')::jsonb WHERE input::text LIKE '%"pergola-sb400"%';

-- pergola-sb500 → helio-panorama
UPDATE "ProductFamily" SET slug = 'helio-panorama' WHERE slug = 'pergola-sb500';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helio-panorama' WHERE "closureFamilySlug" = 'pergola-sb500';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helio-panorama' WHERE "pergolaFamilySlug" = 'pergola-sb500';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helio-panorama' WHERE "optionFamilySlug" = 'pergola-sb500';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helio-panorama' WHERE "pergolaFamilySlug" = 'pergola-sb500';
UPDATE "InstallationRate" SET "familySlug" = 'helio-panorama' WHERE "familySlug" = 'pergola-sb500';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'pergola-sb500', 'helio-panorama') WHERE 'pergola-sb500' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helio-panorama' WHERE "familySlug" = 'pergola-sb500';
UPDATE "Realisation" SET "familySlug" = 'helio-panorama' WHERE "familySlug" = 'pergola-sb500';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helio-panorama' WHERE "familySlug" = 'pergola-sb500';
UPDATE "ReferenceValidation" SET "familySlug" = 'helio-panorama' WHERE "familySlug" = 'pergola-sb500';
UPDATE "ReferenceValidation" SET "targetId" = 'helio-panorama' || substr("targetId", 14) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'pergola-sb500#%';
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"pergola-sb500"', '"helio-panorama"')::jsonb WHERE "systemRules"::text LIKE '%"pergola-sb500"%';
UPDATE "Configuration" SET input = replace(input::text, '"pergola-sb500"', '"helio-panorama"')::jsonb WHERE input::text LIKE '%"pergola-sb500"%';
UPDATE "Configuration" SET result = replace(result::text, '"pergola-sb500"', '"helio-panorama"')::jsonb WHERE result::text LIKE '%"pergola-sb500"%';
UPDATE "CartLine" SET input = replace(input::text, '"pergola-sb500"', '"helio-panorama"')::jsonb WHERE input::text LIKE '%"pergola-sb500"%';

-- screen-refleksol-120-ziiip → helio-ombra
UPDATE "ProductFamily" SET slug = 'helio-ombra' WHERE slug = 'screen-refleksol-120-ziiip';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helio-ombra' WHERE "closureFamilySlug" = 'screen-refleksol-120-ziiip';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helio-ombra' WHERE "pergolaFamilySlug" = 'screen-refleksol-120-ziiip';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helio-ombra' WHERE "optionFamilySlug" = 'screen-refleksol-120-ziiip';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helio-ombra' WHERE "pergolaFamilySlug" = 'screen-refleksol-120-ziiip';
UPDATE "InstallationRate" SET "familySlug" = 'helio-ombra' WHERE "familySlug" = 'screen-refleksol-120-ziiip';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'screen-refleksol-120-ziiip', 'helio-ombra') WHERE 'screen-refleksol-120-ziiip' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helio-ombra' WHERE "familySlug" = 'screen-refleksol-120-ziiip';
UPDATE "Realisation" SET "familySlug" = 'helio-ombra' WHERE "familySlug" = 'screen-refleksol-120-ziiip';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helio-ombra' WHERE "familySlug" = 'screen-refleksol-120-ziiip';
UPDATE "ReferenceValidation" SET "familySlug" = 'helio-ombra' WHERE "familySlug" = 'screen-refleksol-120-ziiip';
UPDATE "ReferenceValidation" SET "targetId" = 'helio-ombra' || substr("targetId", 27) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'screen-refleksol-120-ziiip#%';
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"screen-refleksol-120-ziiip"', '"helio-ombra"')::jsonb WHERE "systemRules"::text LIKE '%"screen-refleksol-120-ziiip"%';
UPDATE "Configuration" SET input = replace(input::text, '"screen-refleksol-120-ziiip"', '"helio-ombra"')::jsonb WHERE input::text LIKE '%"screen-refleksol-120-ziiip"%';
UPDATE "Configuration" SET result = replace(result::text, '"screen-refleksol-120-ziiip"', '"helio-ombra"')::jsonb WHERE result::text LIKE '%"screen-refleksol-120-ziiip"%';
UPDATE "CartLine" SET input = replace(input::text, '"screen-refleksol-120-ziiip"', '"helio-ombra"')::jsonb WHERE input::text LIKE '%"screen-refleksol-120-ziiip"%';

-- store-banne-casablanca → helio-riviera
UPDATE "ProductFamily" SET slug = 'helio-riviera' WHERE slug = 'store-banne-casablanca';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helio-riviera' WHERE "closureFamilySlug" = 'store-banne-casablanca';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helio-riviera' WHERE "pergolaFamilySlug" = 'store-banne-casablanca';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helio-riviera' WHERE "optionFamilySlug" = 'store-banne-casablanca';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helio-riviera' WHERE "pergolaFamilySlug" = 'store-banne-casablanca';
UPDATE "InstallationRate" SET "familySlug" = 'helio-riviera' WHERE "familySlug" = 'store-banne-casablanca';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'store-banne-casablanca', 'helio-riviera') WHERE 'store-banne-casablanca' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helio-riviera' WHERE "familySlug" = 'store-banne-casablanca';
UPDATE "Realisation" SET "familySlug" = 'helio-riviera' WHERE "familySlug" = 'store-banne-casablanca';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helio-riviera' WHERE "familySlug" = 'store-banne-casablanca';
UPDATE "ReferenceValidation" SET "familySlug" = 'helio-riviera' WHERE "familySlug" = 'store-banne-casablanca';
UPDATE "ReferenceValidation" SET "targetId" = 'helio-riviera' || substr("targetId", 23) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'store-banne-casablanca#%';
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"store-banne-casablanca"', '"helio-riviera"')::jsonb WHERE "systemRules"::text LIKE '%"store-banne-casablanca"%';
UPDATE "Configuration" SET input = replace(input::text, '"store-banne-casablanca"', '"helio-riviera"')::jsonb WHERE input::text LIKE '%"store-banne-casablanca"%';
UPDATE "Configuration" SET result = replace(result::text, '"store-banne-casablanca"', '"helio-riviera"')::jsonb WHERE result::text LIKE '%"store-banne-casablanca"%';
UPDATE "CartLine" SET input = replace(input::text, '"store-banne-casablanca"', '"helio-riviera"')::jsonb WHERE input::text LIKE '%"store-banne-casablanca"%';

-- veranda-fts → helio-verriere
UPDATE "ProductFamily" SET slug = 'helio-verriere' WHERE slug = 'veranda-fts';
UPDATE "ClosureCompatRule" SET "closureFamilySlug" = 'helio-verriere' WHERE "closureFamilySlug" = 'veranda-fts';
UPDATE "ClosureCompatRule" SET "pergolaFamilySlug" = 'helio-verriere' WHERE "pergolaFamilySlug" = 'veranda-fts';
UPDATE "OptionCompatRule" SET "optionFamilySlug" = 'helio-verriere' WHERE "optionFamilySlug" = 'veranda-fts';
UPDATE "OptionCompatRule" SET "pergolaFamilySlug" = 'helio-verriere' WHERE "pergolaFamilySlug" = 'veranda-fts';
UPDATE "InstallationRate" SET "familySlug" = 'helio-verriere' WHERE "familySlug" = 'veranda-fts';
UPDATE "Promotion" SET "familySlugs" = array_replace("familySlugs", 'veranda-fts', 'helio-verriere') WHERE 'veranda-fts' = ANY("familySlugs");
UPDATE "PriceGrid" SET "familySlug" = 'helio-verriere' WHERE "familySlug" = 'veranda-fts';
UPDATE "Realisation" SET "familySlug" = 'helio-verriere' WHERE "familySlug" = 'veranda-fts';
UPDATE "SupplierPriceRow" SET "familySlug" = 'helio-verriere' WHERE "familySlug" = 'veranda-fts';
UPDATE "ReferenceValidation" SET "familySlug" = 'helio-verriere' WHERE "familySlug" = 'veranda-fts';
UPDATE "ReferenceValidation" SET "targetId" = 'helio-verriere' || substr("targetId", 12) WHERE "targetType" = 'FAMILY_SPEC' AND "targetId" LIKE 'veranda-fts#%';
UPDATE "ProductFamily" SET "systemRules" = replace("systemRules"::text, '"veranda-fts"', '"helio-verriere"')::jsonb WHERE "systemRules"::text LIKE '%"veranda-fts"%';
UPDATE "Configuration" SET input = replace(input::text, '"veranda-fts"', '"helio-verriere"')::jsonb WHERE input::text LIKE '%"veranda-fts"%';
UPDATE "Configuration" SET result = replace(result::text, '"veranda-fts"', '"helio-verriere"')::jsonb WHERE result::text LIKE '%"veranda-fts"%';
UPDATE "CartLine" SET input = replace(input::text, '"veranda-fts"', '"helio-verriere"')::jsonb WHERE input::text LIKE '%"veranda-fts"%';

-- Codes de commande (moteurs) : seul l'identifiant change, le choix enregistré est conservé
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"radio_rts"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'elero_picolo_xl_rts';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"radio_rts"') WHERE result->'input'->>'familySlug' = 'helio-panorama' AND result->'input'->>'controlCode' = 'elero_picolo_xl_rts';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"radio_rts"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'elero_picolo_xl_rts';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"radio_io"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'elero_picolo_xl_io';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"radio_io"') WHERE result->'input'->>'familySlug' = 'helio-panorama' AND result->'input'->>'controlCode' = 'elero_picolo_xl_io';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"radio_io"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'elero_picolo_xl_io';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"motor_24v_io"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'pergola_24v_io';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"motor_24v_io"') WHERE result->'input'->>'familySlug' = 'helio-panorama' AND result->'input'->>'controlCode' = 'pergola_24v_io';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"motor_24v_io"') WHERE input->>'familySlug' = 'helio-panorama' AND input->>'controlCode' = 'pergola_24v_io';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_1"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'm45_10_26';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_1"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'm45_10_26';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_1"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'm45_10_26';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_2"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'variieco_m_10_14';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_2"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'variieco_m_10_14';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_2"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'variieco_m_10_14';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_3"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'jet_10_17';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_3"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'jet_10_17';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_3"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'jet_10_17';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_4"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'suntop_m';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_4"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'suntop_m';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_4"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'suntop_m';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_5"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'altus_wt';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_5"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'altus_wt';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_5"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'altus_wt';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_6"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'dm45eaf_s_10_26';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_6"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'dm45eaf_s_10_26';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_6"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'dm45eaf_s_10_26';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"electric_7"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'suntop_868_m_10_14';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"electric_7"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'suntop_868_m_10_14';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"electric_7"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'suntop_868_m_10_14';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"radio_rts"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'altus_50_rts_10_17';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"radio_rts"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'altus_50_rts_10_17';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"radio_rts"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'altus_50_rts_10_17';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"radio_io"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'sunilus_scr_io_10_17';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"radio_io"') WHERE result->'input'->>'familySlug' = 'helio-ombra' AND result->'input'->>'controlCode' = 'sunilus_scr_io_10_17';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"radio_io"') WHERE input->>'familySlug' = 'helio-ombra' AND input->>'controlCode' = 'sunilus_scr_io_10_17';
UPDATE "Configuration" SET input = jsonb_set(input, '{controlCode}', '"two_motors"') WHERE input->>'familySlug' = 'helio-verriere' AND input->>'controlCode' = 'two_motors_fts';
UPDATE "Configuration" SET result = jsonb_set(result, '{input,controlCode}', '"two_motors"') WHERE result->'input'->>'familySlug' = 'helio-verriere' AND result->'input'->>'controlCode' = 'two_motors_fts';
UPDATE "CartLine" SET input = jsonb_set(input, '{controlCode}', '"two_motors"') WHERE input->>'familySlug' = 'helio-verriere' AND input->>'controlCode' = 'two_motors_fts';
