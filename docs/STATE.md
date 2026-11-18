# État réel du projet

## Lancement (2026-10-26)

- **Production heliostores.com publique** : pile `heliostores-prod`, image applicative **`8a0465b`** (2026-11-02 :
  dix retours client, catalogue de prix 09.2026 importé et prix affichés pour 7 produits — sections ci-dessous ;
  sauvegarde `db_/media_20261102_102908` avant déploiement ; auparavant `8434cfb`, 2026-10-31 : noms HELIO, logo, chat, configurateur, préparation SELT — section ci-dessous ; auparavant `02d4cce`, 2026-10-27 : carrousel de l'accueil en visualisations générées, WebP/AVIF, cadrage par écran, légende
  « Visualisation » ; mention « visuel du fabricant, non contractuel » retirée des légendes des photos fournisseur —
  runbook § 6 ter ; auparavant `1f311ba`, mission SEO/GEO — `docs/seo/changes-and-validation.md`), compose et script de déploiement `5e1df9c`
  (relais sans interruption, `TZ=Europe/Paris`).
  - Coordonnées commerciales : HELIOSTORES, 59650 Villeneuve-d'Ascq, `contact@heliostores.com`, sans téléphone.
  - Délai de livraison affiché (fiches, récapitulatif, confirmation, nouveaux devis).
  - Administrateur `reda.boutaa@gmail.com` créé et vérifié ; consultation des demandes vérifiée.
  - `MAIL_PROVIDER=hold` : `contact@heliostores.com` n'a ni boîte (pas de MX) ni SMTP ; suivi manuel (runbook § 5 bis).
  - Purge du chat et sauvegarde quotidiennes, restauration vérifiée.
  - Limite anti-abus partagée entre visiteurs IPv6 tant que l'AAAA reste publié (retrait demandé, accès GoDaddy
    indisponible ici).
- Préproduction : commit `a8172e5`, identifiant de revue, noindex.
- État et critères : `docs/launch-readiness.md` ; éléments à fournir : `docs/client-inputs.md` (et Administration →
  Registre de lancement) ; procédures : `docs/production-runbook.md` ; recette : `docs/test-report.md` ;
  SEO/GEO : `docs/seo-geo-plan-90-days.md` et `docs/seo/` (audit, matrice, validation, contenus, partenariats).


## HelioLux « Prix sur devis : corrigez les points signalés » sans point visible (2026-11-18)

- Cause : un brouillon local antérieur à la révision du 2026-11-03 (toile `serge_600` de l'ancien système) écrase la
  configuration de départ ; le serveur bloque à juste titre (`fabric_unavailable`), mais le point n'apparaît qu'à
  l'étape « Pose », la liste « Toile » montre une toile valide (valeur absente → première option, impossible à
  « rechoisir ») et l'avis de révision disparaît (date du brouillon réécrite à chaque visite). Le moteur chiffrait
  correctement la configuration valide (murale 4 000 × 4 000).
- Correctif : cadre de prix listant chaque point bloquant (ancien choix, saisie, non réalisable, erreur technique) avec
  un lien vers l'étape ; pastille sur l'étape concernée ; liste affichant « choix enregistré plus proposé » ; date
  d'origine du brouillon conservée ; panne du calcul = statut `error`, jamais une demande de devis ordinaire.
- Tests : `tests/e2e/26-heliolux-cas-signale.spec.ts` (montant numérique, ancien brouillon), unitaires.
- **Production `573d29b`** (PR #8 non fusionnée, CI verte) : sauvegarde `db_20261118_143309`, aucune migration ni
  synchronisation ; empreintes devis et prix inchangées. Vérifié sur heliostores.com (desktop, mobile) : 3,70 × 3,99 m
  murale, RAL 9010 mat → 6 799 € TTC (5 665,83 € HT) ; ancien brouillon → « Ancien choix à refaire : toile », lien vers
  « Pose et finitions », puis 6 799 €. Retour arrière : `scripts/deploy-production.sh d361dcc933a0`.

## Tranche tarifaire supérieure, couverture des dimensions (2026-11-18) — `docs/pricing/audit-couverture-dimensions.md`

- Règle commerciale HELIOSTORES : plus petite tranche ≥ cote réelle ; sous la première tranche, première tranche si la
  cote respecte le minimum technique documenté (jamais d'extrapolation, de cellule voisine ni d'autre pose).
- Devenues chiffrables : HelioLux avancée 2–3 m (murale et autoportante, cellule 1,5 × 3 m pour 1,5 × 2 m), HelioMax
  largeur 1–1,5 m et avancée 1,318–1,93 m, HelioScreen largeur 0,64–1 m selon le moteur du mode, éclairage HelioLux et
  auvent HelioPro sous la première valeur de leur tableau.
- Corrigés : cellule absente jamais remplacée par une voisine ; stores bannes au plafond / sur chevrons : supports à
  chiffrer (sous-total partiel, plus de faux prix complet) ; HelioRoof démarre sur une teinte standard ; motif précis
  de chaque devis ; prix d'appel = plus petite configuration valide complète (cellules « barre élargie incluse »
  comprises) ; traçabilité dans l'instantané du devis (cotes réelles, tranche, règle, source) ; public : « Tarif calculé
  selon la tranche de dimensions supérieure. » ; devis et PDF émis inchangés.
- Validation isolée : copie de la sauvegarde `db_20261118_115642` (base `tranche_check`, Postgres de développement),
  `catalogue-sync --apply`, build et e2e desktop/mobile. Audit chiffré privé : `private/audit-tranches-2026-11-18/`.
- Restent au devis ou partiels (données fournisseur) : moteurs radio des stores bannes, supports plafond/chevrons,
  HelioScreen < 1 m de hauteur, HelioSlide (vitrage / grille absente), moustiquaires.
- **Production `d361dcc`** (branche `fix/tranche-superieure-audit`, PR #7 **non fusionnée** à la demande, CI verte :
  verify et e2e-docker) : sauvegarde `db_20261118_124220`, aucune migration, `catalogue-sync --apply` (sevilla,
  helioscreen ; second aperçu : 0). Devis et prix actifs inchangés (empreintes identiques), paiement désactivé.
  Vérifié en ligne (desktop, mobile) : HelioLux 1,5 × 2 m chiffrée (murale, autoportante), prix d'appel sur la plus
  petite configuration, poses plafond des stores bannes en sous-total partiel.
- Retour arrière : `scripts/deploy-production.sh 00ee7774c4d2`, puis `catalogue-sync --apply` depuis cette version.

## Gamme par prix d'appel croissant ; dimensions de la liste de prix 09.2026 (2026-11-18) — PR #5

- Production `c4b11b4` (PR #5 fusionnée, CI verte) : sauvegarde `db_20261118_092210`, aucune migration ;
  `catalogue-sync --apply` (5 familles : `systemRules` de marbella, helioscreen, casablanca, corsica, jamaica).
- Ordre : produits par prix d'appel TTC croissant (`listSystemFamilies`), avatars et onglets de l'accueil par prix
  d'appel le plus bas (stores bannes, screens, pergolas, moustiquaires).
- Liste de prix 09.2026 = référence des dimensions et des prix (décision du client) : prix déjà conformes (1 557
  cellules catalogue = PDF ; ventes = catalogue × coefficient unique) ; dimensions corrigées (HelioMax avancée min.
  1 318 mm, HelioScreen 7 × 4 m sans réserve, HelioShade/HelioPro largeur min. 2,05 m puis selon l'avancée, HelioSun
  avancée + 40 cm). Devis et prix actifs inchangés (empreintes identiques avant/après).
- Hauteur maximale de HelioMax : 3,0 m sans réserve (décision du client du 2026-11-18) ; mentions « 2,81 m » retirées (règle, caractéristique, FAQ).
  Production `c11f5a8` (PR #9 non fusionnée, CI verte) : sauvegarde `db_20261118_155030`, `catalogue-sync --apply` (marbella),
  empreintes inchangées ; vérifié en ligne (2,95 et 3 m chiffrés sans réserve, 3,01 m bloqué). Retour arrière : `573d29b34e53`.
- `scripts/pricing-check.ts` compare encore vente = catalogue (règle du 2026-11-02) : toutes les cellules signalées
  depuis la politique du 13/11, sans anomalie de prix ; à adapter.
- Retour arrière applicatif : `IMAGE_TAG=8d8d424d6e6a`, puis `catalogue-sync` depuis cette version.
- Suite (PR #6) : production `00ee777` (sauvegarde `db_20261118_094725`) ; FAQ HelioScreen, HelioSun et HelioShade et
  caractéristique HelioPro alignées sur la liste de prix ; deux questions ouvertes tranchées retirées ;
  `catalogue-sync --apply` (4 familles). Devis et prix actifs inchangés.

## SEO / GEO B15 : métadonnées dans le `<head>` pour les robots d'IA (2026-11-17) — `seo/`

- Production `8d8d424` (PR #4 fusionnée, CI verte) : sauvegarde `db_20261117_114947`, aucune migration ;
  `htmlLimitedBots` = liste Next.js + robots d'IA (`src/server/seo/html-limited-bots.ts`). Après déploiement :
  ClaudeBot et GPTBot 24/24 réponses avec titre et canonique dans le `<head>` (avant : 1/6 en flux pour ClaudeBot) ;
  navigateurs toujours en flux. Devis inchangés ; automatisation réinstallée (sonde « robot d'IA » : 3/3 OK).
- Retour arrière applicatif : `IMAGE_TAG=8c082e58ba41`.

## SEO / GEO : première passe et automatisation (2026-11-16) — `seo/`

- Production `8c082e5` (PR #3 fusionnée, CI verte) : sauvegarde `db_20261116_095522`, aucune migration ; offre
  agrégée JSON-LD (`lowPrice` = prix d'appel affiché), conseils de mesure rendus côté serveur, liens des guides vers les
  fiches ; devis existants inchangés (empreinte identique avant/après).
- Automatisation serveur (`seo/automation/README.md`) : `heliostores-seo-daily.timer` (07:00, contrôle déterministe)
  et `heliostores-seo-weekly.timer` (lundi 08:30, agent `claude -p`, PR en brouillon, jamais de fusion ni de déploiement).

## Arrondi commercial TTC à la terminaison 99 € (2026-11-13) — `docs/pricing/prix-conseilles.md` § 1 bis

- Production `445edfb` : sauvegarde `db_20261113_131732`, migration additive `20261113120000_arrondi_commercial`,
  répétition identique sur copie ; politique de coût v3 (25 % avant arrondi + arrondi TTC 99 €), 11 grilles
  republiées sans changement de cellule ; devis existant inchangé ; prix d'appel 7 099 / 5 499 / 4 699 / 799 / 2 699 /
  1 199 / 1 299 / 599 € TTC retrouvés dans le configurateur ; HelioSquare : sous-total partiel non arrondi.

## Politique 25 %, prix d'appel, « Mes prix conseillés » (2026-11-13) — `docs/pricing/prix-conseilles.md`

- Politique de vente par défaut : marge brute produit 25 % du prix de vente HT (politique de coût v2), grilles de vente
  recalculées par le moteur des grilles (catalogue × 0,84 sur les lignes éligibles ; suppléments d'éligibilité inconnue
  conservés, marge non promise) ; publication autorisée par le client ; versions précédentes conservées.
- Prix d'appel publics « À partir de … € TTC » (HT en second) d'une configuration réelle complète, décrite, ouverte par
  « Configurer » (`?depart=1`) ; HelioSquare : sous-total partiel (moteur à chiffrer).
- Administration → Tarifs → Mes prix conseillés : une ligne par produit, marge cible, marché, prix conseillé expliqué,
  « Préparer ce prix » (brouillon d'une cellule, publication manuelle) ; relevés du 13/11 (105).
- Visuels : illustrations originales de principe qualifiées (HelioMax, HelioLux « toiture en toile », HelioRoof,
  moustiquaires) ; SEO : `docs/seo/audit-2026-11-13.md` ; mentions légales : `private/legal-2026-11-13/`.
- Production `8de89dd` (2026-11-13) : sauvegarde `db_20261113_120011` avant déploiement ; répétition sur copie de la
  production identique ; politique v2 (25 %) publiée sur 11 grilles, 1 projet réévalué, devis inchangé (empreinte
  identique), 105 relevés importés (47 anciens archivés), mentions légales publiées ; 8 prix d'appel retrouvés dans le
  configurateur ; second administrateur créé (hors dépôt).

## Comparatif marché et coût d'achat net (2026-11-04) — `docs/pricing/comparatif-marche.md`

- Administration → Tarifs → Comparatif marché (`/admin/tarifs/comparatif-marche`, administrateurs seulement) : étude
  d'une configuration réelle (prix actuel, coût d'achat net poste par poste, marges, contribution partielle), relevés
  concurrents avec historique, politique de coût versionnée, plancher, scénarios, prix conseillé, propositions en
  brouillon et brouillon de grille d'une seule cellule ; exports CSV internes. Aucun prix public modifié.
- Remise revendeur 37 % (décision du 2026-11-04) : politique de coût v1 ; éligibilité des postes fixes à confirmer ;
  objectif de marge non défini (aucun prix conseillé tant qu'il ne l'est pas).
- Première étude : 49 relevés publics (PERGOLUX, NEO10, Castorama, Sunny Inch, Vente-unique, Truffaut…) ; aucune offre
  fortement comparable retenue (livraison et LED comprises, HT/TTC non indiqué, kits) : simulations internes seulement.
- Production `b67648c` (2026-11-05) : sauvegarde `db_20261105_090941` avant déploiement, migration
  `20261104090000_comparatif_marche` appliquée, politique v1 (37 %, effet 04/11/2026) et 49 relevés importés (seconde
  passe : 0 créé) ; empreinte des prix publics identique avant/après ; page admin 307 et export 404 sans session.

## Correspondances SOLID / VÉRANDA V ZiiiP, moteurs et options (2026-11-03) — `docs/pricing/catalogue-2026-09.md`

- HelioLux = SOLID et HelioRoof = VÉRANDA V ZiiiP (confirmés par le client) : fiches, configurateurs et données
  remplacés (dimensions, poses, toiles, commandes, options) ; photos d'un autre système retenues (dessin du modèle) ;
  anciens projets signalés pour revalidation, jamais convertis ; devis émis inchangés.
- Prix affichés pour les neuf produits configurables (grilles de vente = catalogue × 1, TVA 20 %, dimension supérieure
  entre deux valeurs) ; import 1 603 lignes (345 suppléments : modes de commande, télécommandes, capteurs, box,
  éclairages, poteaux, auvent, hauteur hors norme) ; contrôle cellule par cellule 1 556 / 0 écart.
- Modes de commande compréhensibles (filaire, radio RTS, radio io…) ; moteur déduit du mode et du couple : montant
  si un seul moteur convient, fourchette « à chiffrer » sinon ; comparatif des modes dans le configurateur.
- Questions fournisseur restantes : `docs/pricing/questions-fournisseur-2026-11.md`. Livraison et pose au devis ;
  paiement en ligne désactivé ; langues préparées non activées.

## Catalogue de prix 09.2026 (2026-11-02)

- Import, grilles catalogue internes, grilles de vente et décisions écrites du client (`docs/DECISIONS.md`) ;
  simulateur A/B/C/D, suppléments éditables, réévaluation d'un devis ; commande en ligne fermée.

## Itération du 2026-11-01 (dix retours client) — `docs/client-feedback-followup.md`

- Langues fr / es / nl / de / en préparées (préfixes, dictionnaires, sélecteur, aperçus noindex) — **non activées en
  production** (`SITE_LOCALES`, runbook § 2 quater) ; marchés distincts des langues, tous « à valider » sauf la France.
- Habillage saisonnier réglable, inactif hors période (Réglages) ; moustiquaires MoskiUp / MoskiSlide / MoskiFix en
  demande d'étude ; coloris audités par modèle (standard / avec supplément, nuancier cité) ; accueil rééquilibré
  (un détail par famille) ; motif du « prix sur devis » ; étape du configurateur dans l'adresse et brouillon par projet ;
  hauteur de pose (souhait) des stores bannes et d'HelioRoof ; logo 44 px « — Accueil ».
- Migration `20261101090000_habillage_saisonnier`.

## Livraison du 2026-10-31 (noms HELIO, logo, chat, configurateur, préparation SELT) — production `8434cfb`

- **Noms HELIO** (transcodification validée par le client) appliqués : HelioSky, HelioMax, HelioLux, HelioRoof, HelioSun,
  HelioShade, HelioPro, HelioSquare (HelioScreen, moustiquaires inchangés), HelioSlide VERRE / ALU (souhaits de
  fermeture). Slugs et URL inchangés, anciens noms en alias internes, historique intact. Écarts techniques ouverts :
  HelioLux = SOLID, HelioRoof = VERANDA V ZiiiP, HelioSlide ALU = SYSTEM SLIDE (`docs/product-naming-transco.csv`,
  `docs/heliostores/nomenclature.md`). En base : `scripts/catalogue-sync.ts`, `scripts/media-names-sync.ts` (runbook § 2 ter).
- **Bandeau** : au défilement, logo agrandi et centré, hauteur du bandeau constante (aucun saut), aucune collision.
- **Chat** : aide immédiate déterministe + demandes collectées ; **aucun LLM configuré** ; raccordement prêt
  (anthropic ou API compatible OpenAI, plafonds, masquage des coordonnées) — `docs/chatbot.md`.
- **Configurateur** : pastilles de teintes nommées, fermetures distinctes par côté, repères, aperçu mobile —
  `docs/configurator-visual-upgrade.md`.
- **Tarifs SELT** : format normalisé, nature « prix catalogue fournisseur », remise fournisseur ; **aucun catalogue
  reçu, aucun prix publié** — `docs/pricing/selt-import.md`. Répertoire privé : `inputs/heliostores/selt-pricing/`.

Mis à jour : 2026-10-21 (refonte « catalogue fabricant ») — **migration HELIOSTORES** (branche `feat/heliostores`, draft PR #2 vers `feat/storefront-configurator`).
Le bilan complet est dans `docs/heliostores/README.md`, avec les sources, correspondances, médias, la revue tarifaire, l'import et l'identité.

## HELIOSTORES (en cours de revue)

- **Itération du 2026-10-25** (`docs/heliostores/iteration-2026-10-25.md`, migrations `20261025090000_quatre_familles` à
  `…110000_paiements_stripe`) : **quatre familles** — Pergolas (Malaga SB 350 en tailles fixes, Marbella SB 450, Sevilla
  V ZiiiP à toiture toile), Screens (HelioScreen = ex-HELIO Ombra, HelioRoof Screen = Veranda), Stores bannes (Casablanca
  = ex-HELIO Riviera, Corsica = ex-HELIO Azur, Jamaica, Madera), Moustiquaires (MoskiFold, MoskiFold 2 ; MoskiUp,
  MoskiSlide, MoskiFix en brouillon). SB 400 / SB 500 / VERANDA FTS **retirés** (archivés, page explicative, aucune
  conversion). Données sourcées dans `src/server/catalog/families/*`. Configurateur en étapes avec **dessin paramétrique
  2D lié aux choix** (3D à la demande, Intérieur et Ambiance nuit retirées), tailles fixes et demande hors gamme,
  souhaits d'équipement au devis ; navigation latérale ; bleu-vert du logo + orange d'accent **provisoire** ;
  `/accessoires`, `/guides/prise-de-mesures`, `/guides/choisir-toile-et-motorisation`, `/references` ; Stripe :
  moyens dynamiques, virement, Alma conforme (B2C, domestique), paiement d'un devis accepté, paiement tardif à examiner,
  garde-fous du compte — **aucun compte Stripe raccordé** (`docs/heliostores/stripe.md`). Médias du 2026-10-25 :
  `pnpm media:heliostores --dir private/heliostores/media-staging --apply` (sous-dossier `2026/`).

- **Nomenclature commerciale** (déployé c5c2619, migrations `20261022090000_heliostores_nomenclature` et `…091000_…_labels`) :
  HELIO Horizon, Panorama, Ombra, Riviera (`/pergolas/helio-horizon`…), HELIO Verrière réservé en brouillon ; références
  fournisseur en `supplierRef` (admin : « Correspondance fournisseur »), redirections 308 des anciennes URL, codes moteur
  renommés, devis émis inchangés. Détail : `docs/heliostores/nomenclature.md`. **Reste à faire en préproduction** : réimporter
  les métadonnées des médias (`pnpm media:heliostores --dir <staging monté en lecture seule> --apply` dans le conteneur
  `migrate`) ; tant que ce n'est pas fait, 40 textes alternatifs et légendes gardent les anciens noms.
- **Refonte « catalogue fabricant »** (déployé 0d16dc4) : grand visuel à vues manuelles, en-tête superposé puis compact, panneaux
  « Nos solutions » extensibles avec dessins au trait blanc, modèles sur fond blanc, galerie Photos / 3D / Dessins, Montserrat ;
  matrice : `docs/design/reference-matrice.md`, QA : `docs/design/visual-qa.md` (itération 2). Sauvegarde : `backups/preprod/db_20261021_165710.dump`.
- **Refonte visuelle, itération 1** (commits d421f5c → 9c6b318) : accueil à sélecteur par dessins SVG (pergola, screen, store banne),
  méga-menu illustré, collections en rangées avec comparatif, fiche avec bloc Inclus / En option, configurateur avec aperçu,
  récapitulatif et prix collants et barre de prix mobile ; Manrope + Inter ; aucune dépendance ajoutée ; règles, prix, formulaires,
  API et 3D inchangés. Brief, direction artistique, plan et QA : `docs/design/`. Sauvegarde avant déploiement :
  `backups/preprod/db_20261021_153109.dump` et `media_20261021_153109.tar.gz`.

- **Marque** HELIOSTORES (logo client), trois familles publiques : Pergolas (SB400, SB500), Screens (REFLEKSOL 120 ZiiiP), Stores bannes (CASABLANCA).
  VERANDA FTS reste en brouillon, son classement est à décider.
- **Configurateur générique des systèmes** (`src/domain/system.ts`, `/configurateur/<produit>`) : règles sourcées, 3D pour pergola, screen et store,
  prix de la structure lu dans la grille « Prix final HELIOSTORES » du classeur, en **€ HT** (décision client du 2026-10-21,
  `docs/heliostores/prix-publics.md`). **Commande en ligne** d'une configuration entièrement tarifée (structure seule : prix de grille,
  sans option, pose ni choix à confirmer), TVA ajoutée au panier, livraison et pose non comprises, paiement simulé ; sinon devis.
- **Réalisations et Showroom masqués** (404, `PUBLIC_SECTIONS`) ; autres pages provisoires conservées (audit : `docs/heliostores/audit-pages.md`).
  Bilan à transmettre au client : `docs/heliostores/bilan-client.md`.
- **Retour client du 2026-10-21** (appliqué le 2026-10-23, `docs/heliostores/retour-client-2026-10-21.md`) : accueil par dessins
  dès le premier écran ; noms HELIO modifiables avec historique ; stores bannes en niveaux (HELIO Riviera Essentiel /
  Confort, Premium = HELIO Azur en brouillon) ; options avec prérequis et comportement au vent par produit ; guides
  d'installation en brouillon jusqu'à validation technique (web + PDF) ; réalisations / production (emplacements à
  fournir) ; page « Modes de paiement » ; explication des prix et fiche de décisions.
- **Écran Tarifs** (2026-10-23, `docs/heliostores/administration-tarifs.md`) : grilles versionnées par produit × variante, éditeur matriciel,
  paramètres commerciaux, vérification, publication immédiate ou programmée, désactivation, reprise, comparaison, simulateur,
  import depuis l'administration. Seules les grilles de vente publiées alimentent le site ; lecture **exacte** des cotes par défaut
  (l'arrondi à la dimension supérieure n'est plus appliqué faute de confirmation). Fichiers importés : trace brute, plus d'activation.
- **Site public sans référence au fabricant ni au fournisseur** : pas de sources, marque, crédits photo ni documents fabricant (archivés) ;
  les sources restent dans l'administration.
- **Médias fabricant** importés par `pnpm media:heliostores --dir private/heliostores/media-staging --apply` ; les fichiers restent privés.
- **Ancien catalogue de démonstration** archivé (`legacy`), conservé pour l'historique ; `SEED_LEGACY_DEMO=active` le réactive pour les seuls tests d'intégration.
- **Vérifications** (commit déployé `d367e97`, commande en ligne de la structure seule ; libellé d'authentification Traefik « HELIOSTORES - revue ») :
  - typecheck ✅, lint ✅ (0 erreur), unitaires 204/204 ✅, intégration 82/82 ✅ (panier → commande → paiement simulé → e-mails) ;
  - recette navigateur en dev avec la grille active : 33/33 ✅ ;
  - recette HTTPS directe de la commande en ligne (`E2E_BASE_URL=https://… E2E_HTTP_USER/E2E_HTTP_PASSWORD scripts/e2e-docker.sh .env.prod tests/e2e/08-commande-systeme.spec.ts --no-deps`) : 4/4 ✅ ;
  - contrôle HTTPS : 20 pages en 200, Réalisations/Showroom/VERANDA FTS en 404, aucune mention du fabricant, du fournisseur ni d'ELIOS SOLAR, noindex ✅ ; médias conformes ✅.
  - Sauvegarde avant déploiement : `backups/preprod/db_20261021_105905.dump` et `media_20261021_105905.tar.gz`.
- **Décisions client (2026-10-21)** : VERANDA FTS hors catalogue public (brouillon) ; prix du classeur affichés en € HT (mise à jour du jour, remplace « tout sur devis ») ; commande en ligne de la structure seule (paiement simulé) ; Réalisations et Showroom masqués ; 7 dossiers de validation ouverts. Questions : `docs/heliostores/validation-fournisseur.md` ; revue : `docs/heliostores/revue-client.md`.
- **Médias** : volume `elios_solar_uploads` conservé entre redéploiements ; sauvegarde `MEDIA_VOLUME=elios_solar_uploads scripts/backup.sh backups/preprod` ; contrôle `scripts/check-public-media.ts` (voir `docs/heliostores/medias.md`).
- **Préproduction** https://demo-elios.beaverdata.eu (identifiants de revue inchangés). Dernière sauvegarde : `backups/preprod/db_20261020_210852.dump` et `media_20261020_210852.tar.gz`, avec leurs empreintes.
- **Recette contre Docker** : remettre temporairement `NEXT_PUBLIC_SITE_URL` et `BETTER_AUTH_URL` sur `http://127.0.0.1:3401`, lancer `scripts/e2e-docker.sh .env.prod`, puis rétablir l'URL HTTPS (procédure suivie pour cette livraison).
- **Fichiers privés**, exclus de Git et de Docker : `inputs/` (les 9 sources client) et `private/` (extractions, rapports chiffrés, médias préparés, pages ALUPROF).

## Historique (itérations 1 à 4, catalogue de démonstration)
- Dépôt : `redaboutaa-sketch/elios-solar`, branche `feat/storefront-configurator` (depuis `main` = commit initial).
- Préproduction locale : `pnpm dev` sur http://127.0.0.1:3400 (toutes les pages publiques répondent 200).
- Base : PostgreSQL 16 en conteneur `elios-solar-dev-postgres` (127.0.0.1:5433), migrations appliquées, seed exécuté.
- E-mails : Mailpit http://127.0.0.1:8025 (SMTP 1025) ; worker `pnpm mail:worker`.
- Paiement : mode DEMO (page de paiement simulé + webhook signé HMAC).
- **Préproduction Docker à jour** : commit exposé par `GET /api/health` (`commit`, `builtAt`, `lastMigration`) et dans le bandeau de l'administration. Redéploiement : `export GIT_COMMIT=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%FT%TZ); docker compose -f docker/compose.prod.yml --env-file .env.prod build migrate app && docker compose -f docker/compose.prod.yml --env-file .env.prod up -d && docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm migrate pnpm db:seed`. Sauvegarde préalable dans `backups/preprod/` (non commité).
- Préproduction Docker : `docker compose -f docker/compose.prod.yml --env-file .env.prod up -d` → http://127.0.0.1:3401 (images `elios-solar/app:preprod`, `elios-solar/tools:preprod`, migrations appliquées par le service `migrate`, seed démo exécuté, santé OK, worker e-mail actif). `.env.prod` local non commité.
- Recette navigateur complète contre Docker : `scripts/e2e-docker.sh .env.prod` (une campagne, sans relance ; session admin unique via le projet `setup`, un client simulé distinct par parcours). Même campagne en CI (job `e2e-docker`).
- Sauvegarde/restauration : `scripts/backup.sh` et `scripts/restore.sh` testés (dump + médias + checksums ; restauration vérifiée dans une base isolée `elios_solar_restore_check`).
- Vérifications passées (itération 4, commit 95936fb) : typecheck ✅, lint ✅, unitaires 133/133 ✅, intégration 65/65 ✅, build Docker ✅, recette navigateur complète contre Docker 53/53 ✅ en une campagne (détail : `docs/test-report.md`).
- Audit comparatif v2 avec REA : `docs/gap-analysis-v2.md` (écarts, priorités, médias manquants).
- Administration : http://127.0.0.1:3400/admin (compte créé par `pnpm admin:bootstrap`).

## Commandes utiles
```bash
docker compose -f docker/compose.dev.yml up -d      # PostgreSQL + Mailpit (dev)
cp .env.example .env && openssl rand -base64 32     # renseigner BETTER_AUTH_SECRET
pnpm install --frozen-lockfile
pnpm db:migrate && pnpm db:seed                     # migrations + démo
pnpm admin:bootstrap                                # crée l'administrateur (mot de passe saisi masqué)
# en Docker : docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm -e ADMIN_EMAIL=... -e ADMIN_PASSWORD="$(cat secret)" migrate pnpm admin:bootstrap
pnpm dev                                            # http://127.0.0.1:3400
pnpm mail:worker                                    # traite la file d'e-mails
pnpm typecheck && pnpm lint && pnpm test:unit
```
Accès distant : tunnel SSH `ssh -L 3401:127.0.0.1:3401 -L 3400:127.0.0.1:3400 -L 8025:127.0.0.1:8025 root@<vps>` (3401 = pile Docker, 3400 = serveur de dev s'il tourne, 8025 = Mailpit).

## Itération 3
Statut de chaque écart : `docs/iteration3/README.md`. Nouvelles pages d'administration : Stocks & délais, Grilles sur mesure, Conversations, Documents, Médias → associations, Paiement fractionné.

## Prochaine action
Revue de la préproduction ; fourniture des données fournisseur listées dans `docs/launch-blockers.md` (photos, notices, grille sur mesure, assemblages persienne, câble, délais) ; comptes Stripe/Alma/Klarna et SMTP ; puis domaine Traefik après revue.

## Procédure de reprise (tmux)
`tmux attach -t pergola` ; lire `docs/STATE.md`, `docs/TASKS.md`, `git status` / `git diff` avant de reprendre.
