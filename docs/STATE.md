# État réel du projet

## Lancement (2026-10-26)

- **Production heliostores.com publique, sur devis** (2026-10-26) : pile `heliostores-prod`, image applicative
  **`02d4cce`** (2026-10-27 : carrousel de l'accueil en visualisations générées, WebP/AVIF, cadrage par écran, légende
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
