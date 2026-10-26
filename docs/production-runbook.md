# Runbook de production — heliostores.com

> Document publiable : aucun secret, aucun montant. Les secrets sont dans `.env.heliostores-prod` (600, jamais commité ; ne pas le nommer `.env.production`, que Next.js charge automatiquement en local) ;
> l'accès de revue de la préproduction reste dans `/root/elios-solar-revue.txt`.

## 1. Environnements

| | Préproduction | Production |
|---|---|---|
| Domaine | `demo-elios.beaverdata.eu` | `heliostores.com` (+ `www` redirigé, 301) |
| Compose | `docker/compose.prod.yml` + `.env.prod` | `docker/compose.production.yml` + `.env.heliostores-prod` |
| Projet / conteneurs | `elios-solar` · `elios-solar-{app,worker,postgres}` | `heliostores-prod` · `heliostores-prod-{app,worker,postgres}` |
| Base / volumes | `elios_solar_pg`, `elios_solar_uploads` | `heliostores_prod_pg`, `heliostores_prod_uploads` |
| Réseau interne | `elios_solar_internal` | `heliostores_prod_internal` |
| Port local (contrôle) | `127.0.0.1:3401` | `127.0.0.1:3402` |
| Accès | identifiant de revue (Traefik) | public, aucune authentification de revue |
| Indexation | `SITE_INDEXABLE=false` : noindex partout, robots `Disallow: /` | `SITE_INDEXABLE=true` : noindex seulement sur les pages privées |
| Paiement | `PAYMENT_PROVIDER=demo` (simulateur, non public) | `PAYMENT_PROVIDER=disabled` tant que Stripe n'est pas raccordé |
| E-mails | `MAIL_PROVIDER=log` | `MAIL_PROVIDER=hold` tant qu'aucun SMTP n'est fourni |

Les deux piles utilisent les mêmes images (`elios-solar/app:<commit>`, `elios-solar/tools:<commit>`). L'indexation
(`X-Robots-Tag`, robots.txt, sitemap, balises meta) est décidée **à l'exécution** (`src/proxy.ts`, `SITE_INDEXABLE`) :
une image construite pour la préproduction peut servir la production sans fuite de noindex, et inversement.

Mode d'encaissement (`src/server/payment/mode.ts`) : `stripe` seulement avec clé secrète **et** secret de webhook ;
le simulateur n'est jamais actif sur un site indexable ; toute autre combinaison donne `disabled` (panier, commande et
paiement de devis refusés côté serveur, le configurateur reste explorable et mène au devis).

## 2. Construire une version identifiée

```bash
cd /opt/pergola
git status --short            # arbre propre, commit poussé, CI verte sur ce commit
export GIT_COMMIT=$(git rev-parse HEAD) BUILD_TIME=$(date -u +%FT%TZ) TAG=$(git rev-parse --short=12 HEAD)
docker compose -f docker/compose.prod.yml --env-file .env.prod build migrate app      # images elios-solar/*:preprod
docker tag elios-solar/app:preprod elios-solar/app:$TAG && docker tag elios-solar/tools:preprod elios-solar/tools:$TAG
```

`GET /api/health` renvoie `commit`, `builtAt` et `lastMigration` : c'est la preuve du commit exécuté.

## 3. Première mise en place de la production

1. Sauvegarde de la préproduction (source des données de catalogue) :
   `MEDIA_VOLUME=elios_solar_uploads bash scripts/backup.sh backups/preprod` puis `chmod 600 backups/preprod/*`.
2. Vérification de restauration dans un PostgreSQL jetable (sans réseau, sans volume) : voir § 6.
3. Fixer `IMAGE_TAG=<TAG>` dans `.env.heliostores-prod`, puis créer la base :
   `docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod up -d postgres`.
4. Copie purgée : `scripts/prepare-production-db.sh backups/preprod/db_<horodatage>.dump backups/preprod/media_<horodatage>.tar.gz`
   (refuse une base non vide ; supprime comptes, devis, commandes, paiements simulés, conversations, e-mails,
   consentements de test ; garde catalogue, tarifs, médias catalogue, documents, registre ; exclut les visuels de devis).
5. Migrations et catalogue :
   `docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm migrate` puis
   `docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm migrate pnpm db:seed`.
6. Démarrage : `docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod up -d`.
7. Administrateur (saisie masquée, rien dans le dépôt ni dans les journaux) : la personne habilitée lance elle-même
   `! docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm -it migrate pnpm admin:bootstrap`.
8. Réglages (Administration → Réglages) : identité légale, contact public, domaine ; publier les pages légales validées.
9. Contrôle local : `curl -s http://127.0.0.1:3402/api/health`, pages principales, robots, sitemap (§ 5).

## 4. Ouverture publique (DNS)

Préalables : identité légale et pages légales publiées (registre de lancement), contrôle local vert.

Enregistrements à créer chez le registraire du domaine (GoDaddy, serveurs `ns55/ns56.domaincontrol.com`) — remplacer
les enregistrements actuels du site GoDaddy :

| Type | Nom | Valeur | TTL |
|---|---|---|---|
| A | `@` | `76.13.44.177` | 600 |
| AAAA | `@` | `2a02:4780:7:f4ca::1` | 600 |
| CNAME | `www` | `heliostores.com.` | 600 |

Optionnel : `CAA @ 0 issue "letsencrypt.org"`. Ne pas toucher aux enregistrements MX/TXT éventuels d'une messagerie.

Puis, quand `dig +short heliostores.com` renvoie `76.13.44.177` (et `www` aussi) :
```bash
sed -i 's/^TRAEFIK_ENABLE=.*/TRAEFIK_ENABLE=true/' .env.heliostores-prod
docker inspect traefik -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'   # = TRUSTED_PROXIES
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod up -d --no-deps app
```
Traefik obtient les certificats Let's Encrypt (défi TLS-ALPN) pour `heliostores.com` et `www.heliostores.com`.

## 5. Contrôles après déploiement (non destructifs)

```bash
curl -sI https://heliostores.com/ | grep -iE '^(HTTP|x-robots-tag|strict-transport)'      # 200, aucun X-Robots-Tag
curl -sI https://www.heliostores.com/pergolas | grep -iE '^(HTTP|location)'              # 301 → https://heliostores.com/pergolas
curl -s https://heliostores.com/robots.txt ; curl -s https://heliostores.com/sitemap.xml | head
curl -sI https://heliostores.com/compte | grep -i x-robots-tag                             # noindex, nofollow
curl -s https://heliostores.com/api/health                                               # commit attendu
curl -sI https://demo-elios.beaverdata.eu/ | head -1                                       # 401 : préproduction protégée
```
Aucune commande, aucun paiement, aucun devis réel n'est créé par ces contrôles. Une demande de devis de test se fait
avec une adresse `@test.invalid`, puis est supprimée (Administration → Devis) — ou mieux, sur la préproduction.

## 6. Sauvegardes et restauration

- Sauvegarde : `PG_CONTAINER=heliostores-prod-postgres POSTGRES_USER=heliostores POSTGRES_DB=heliostores MEDIA_VOLUME=heliostores_prod_uploads bash scripts/backup.sh backups/production && chmod 600 backups/production/*`.
  À planifier (cron quotidien) et à copier hors du VPS : **non planifié à ce jour** (aucune destination externe fournie).
- Vérification isolée (aucun effet sur les bases en service) :
  ```bash
  docker run -d --rm --name heliostores-restore-check --network none -e POSTGRES_USER=check -e POSTGRES_PASSWORD=check -e POSTGRES_DB=check --tmpfs /var/lib/postgresql/data postgres:16-alpine
  docker exec -i heliostores-restore-check pg_restore --no-owner -U check -d check < backups/…/db_<horodatage>.dump
  docker exec heliostores-restore-check psql -U check -d check -Atc 'select count(*) from "ProductFamily"'
  docker stop heliostores-restore-check
  ```

## 7. Retour arrière

- **Version applicative** : remettre l'`IMAGE_TAG` précédent dans `.env.heliostores-prod` puis
  `docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod up -d --no-deps app worker`.
  Les migrations sont additives ; si une migration doit être annulée, restaurer la sauvegarde prise avant le déploiement.
- **Données** : arrêter l'app, `pg_restore --clean --if-exists` de la sauvegarde dans `heliostores-prod-postgres`
  (après vérification isolée), redémarrer.
- **Ouverture publique** : `TRAEFIK_ENABLE=false` puis `up -d --no-deps app` retire le routage sans rien supprimer ;
  ou remettre les enregistrements DNS précédents chez le registraire.
- **Prix** : une grille désactivée se reprend en brouillon puis se republie (Administration → Tarifs).
- Ne jamais supprimer de volume ; ne jamais lancer `docker compose down -v` ni `docker volume prune`.

## 8. Stripe (quand les clés de test seront fournies)

Voir `docs/heliostores/stripe.md`. Variables à déposer dans le fichier d'environnement du serveur (jamais dans la
conversation, un ticket ou le dépôt) : `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_…`,
`STRIPE_WEBHOOK_SECRET=whsec_…`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`, `STRIPE_ACCOUNT_ID=acct_…`,
`PAYMENT_LIVE_ENABLED=false`. Point de notification : `https://<domaine>/api/webhooks/stripe`. Sur la préproduction,
l'exception d'accès limitée à cette route est prête : `docker/compose.preprod-stripe-webhook.yml` (non activée).
