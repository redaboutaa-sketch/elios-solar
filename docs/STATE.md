# État réel du projet

Mis à jour : 2026-10-21 — **migration HELIOSTORES** (branche `feat/heliostores`, draft PR #2 vers `feat/storefront-configurator`).
Le bilan complet est dans `docs/heliostores/README.md`, avec les sources, correspondances, médias, la revue tarifaire, l'import et l'identité.

## HELIOSTORES (en cours de revue)

- **Marque** HELIOSTORES (logo client), trois familles publiques : Pergolas (SB400, SB500), Screens (REFLEKSOL 120 ZiiiP), Stores bannes (CASABLANCA).
  VERANDA FTS reste en brouillon, son classement est à décider.
- **Configurateur générique des systèmes** (`src/domain/system.ts`, `/configurateur/<produit>`) : règles sourcées, 3D pour pergola, screen et store,
  **prix toujours sur devis** (`priceMode: "quote"`).
- **Tarifs fournisseur** importés en privé (`pnpm supplier-prices:import`, Administration → Tarifs fournisseur), jamais lus par la boutique.
- **Médias fabricant** importés par `pnpm media:heliostores --dir private/heliostores/media-staging --apply` ; les fichiers restent privés.
- **Ancien catalogue de démonstration** archivé (`legacy`), conservé pour l'historique ; `SEED_LEGACY_DEMO=active` le réactive pour les seuls tests d'intégration.
- **Vérifications** (commit déployé `4bfb76c`) :
  - typecheck ✅, lint ✅ (0 erreur), unitaires 194/194 ✅, intégration 80/80 ✅ ;
  - **recette navigateur complète contre Docker : 29/29 en une campagne, sans relance** ✅ ;
  - CI `verify` et `e2e-docker` (29/29) ✅ sur push et PR ;
  - contrôle externe HTTPS (identité, images, 3D des trois types, compte, devis) ✅.
- **Décisions client (2026-10-21)** : VERANDA FTS hors catalogue public (brouillon) ; tout sur devis ; tarifs en brouillon jusqu'à un écrit du fournisseur ; 7 dossiers de validation ouverts. Questions : `docs/heliostores/validation-fournisseur.md` ; revue : `docs/heliostores/revue-client.md`.
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
