# État réel du projet

Mis à jour : 2026-10-19 — incréments 1 à 5 livrés (version intégrée en préproduction)

## Où en est-on
- Dépôt : `redaboutaa-sketch/elios-solar`, branche `feat/storefront-configurator` (depuis `main` = commit initial).
- Préproduction locale : `pnpm dev` sur http://127.0.0.1:3400 (toutes les pages publiques répondent 200).
- Base : PostgreSQL 16 en conteneur `elios-solar-dev-postgres` (127.0.0.1:5433), migrations appliquées, seed exécuté.
- E-mails : Mailpit http://127.0.0.1:8025 (SMTP 1025) ; worker `pnpm mail:worker`.
- Paiement : mode DEMO (page de paiement simulé + webhook signé HMAC).
- Préproduction Docker : `docker compose -f docker/compose.prod.yml --env-file .env.prod up -d` → http://127.0.0.1:3401 (images `elios-solar/app:preprod`, `elios-solar/tools:preprod`, migrations appliquées par le service `migrate`, seed démo exécuté, santé OK, worker e-mail actif). `.env.prod` local non commité.
- Sauvegarde/restauration : `scripts/backup.sh` et `scripts/restore.sh` testés (dump + médias + checksums ; restauration vérifiée dans une base isolée `elios_solar_restore_check`).
- Vérifications passées : typecheck ✅, lint ✅, unitaires 32/32 ✅, intégration 14/14 ✅, Playwright 22/22 ✅, build ✅ (détail : `docs/test-report.md`).
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

## Prochaine action
Revue de la préproduction par le propriétaire ; collecte des données fournisseur (import CSV), identité et contenus ; puis vue 3D (incrément 6) et bascule Stripe/domaine après revue.

## Procédure de reprise (tmux)
`tmux attach -t pergola` ; lire `docs/STATE.md`, `docs/TASKS.md`, `git status` / `git diff` avant de reprendre.
