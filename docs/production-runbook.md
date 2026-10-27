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

## 2 bis. Déployer la production sans interruption

Après une sauvegarde (§ 6) et avec la CI verte sur le commit :
```bash
scripts/deploy-production.sh <TAG>      # ex. 0886bb3bcd1c
```
Le script, limité au projet `heliostores-prod`, procède en quatre temps :
1. Il met `IMAGE_TAG` à jour et lance les migrations. Elles doivent rester additives : l'ancienne version tourne encore.
2. Il démarre le relais `app-relay` (profil `relay`, nouvelle image, mêmes labels Traefik) et attend qu'il soit sain.
   Traefik répartit alors entre l'ancienne et la nouvelle instance.
3. Il recrée `app` et le worker, puis attend qu'`app` soit sain (sonde de démarrage toutes les 2 s).
4. Il vide le relais : sa sonde échoue (`/tmp/drain`), Traefik le retire du routage, puis il est supprimé.

Un middleware de nouvel essai (`heliostores-prod-retry`, propre au routeur HELIOSTORES) couvre les échecs de
connexion. Mesure du 2026-10-26 : 3 déploiements, 1 001 requêtes publiques, aucune erreur.

Limites :
- si les **labels Traefik** changent entre deux versions, Traefik refuse un routeur défini différemment par deux
  conteneurs (404 observés le 2026-10-26). Le script le détecte, recrée `app` directement et annonce une coupure de
  quelques secondes ;
- pendant le recouvrement, les deux versions répondent et les compteurs anti-abus en mémoire sont propres à chaque
  instance ;
- échec avant l'étape 3 : l'ancienne `app` sert toujours et `IMAGE_TAG` est remis à sa valeur précédente.

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
Traefik obtient les certificats Let's Encrypt (défi TLS-ALPN) pour `heliostores.com` et `www.heliostores.com`
(un certificat par nom, routeurs distincts).

**Mise à jour 2026-10-26, 11:13 UTC** : les deux A « WebsiteBuilder Site » ont été supprimés par le propriétaire ; ns55,
ns56, 1.1.1.1, 8.8.8.8 et 9.9.9.9 ne renvoient plus que `76.13.44.177` / `2a02:4780:7:f4ca::1` ; 11 sondes HTTP
externes sur 12 reçoivent 200 de ce serveur (la 12e en erreur côté sonde) ; IPv6 joignable de l'extérieur sur 443.
Le paragraphe suivant décrit la situation antérieure.

**État au 2026-10-26 (avant correction)** : routeur activé à 10:47 UTC (commit `7a70796`), certificats délivrés du premier coup pour les
deux noms. La zone GoDaddy contenait **encore deux A `@` « WebsiteBuilder Site »** (`76.223.105.230`, `13.248.243.5`,
site GoDaddy hébergé chez Amazon) à côté de `76.13.44.177` : un visiteur IPv4 arrive au hasard sur l'un des trois
(contrôle externe check-host.net : 7 sondes sur 8 sur GoDaddy). Correction chez GoDaddy (DNS de heliostores.com) :
supprimer ces deux enregistrements A **et** déconnecter le domaine du site Website Builder (Mes produits → Sites web →
paramètres du site → domaine), sinon GoDaddy peut les recréer. Ne pas toucher NS/SOA ; la zone n'a ni MX ni TXT.
Contrôle : `for r in 1.1.1.1 8.8.8.8 9.9.9.9; do dig +short @$r heliostores.com A; done` ne doit plus renvoyer que
`76.13.44.177`, puis contrôle HTTP multi-sondes (`https://check-host.net/check-http?host=https://heliostores.com/api/health`).

IPv6 — limite partagée (analyse du 2026-10-26) : le port 443 en IPv6 est servi par `docker-proxy -host-ip ::` (le
réseau commun `traefik-public` n'a pas l'IPv6) ; ce relais ouvre la connexion vers Traefik depuis la passerelle
`172.23.0.1`. Traefik, donc `X-Forwarded-For`, puis better-auth et `src/server/rate-limit.ts` voient **la même adresse
pour tous les visiteurs IPv6**. Conséquence : les limites (devis 10 / 10 min, contact 8 / 10 min, connexion 3 / 10 s par
chemin, 30 / min) sont communes à l'ensemble des visiteurs IPv6 — refus possibles en cas d'affluence, jamais de
contournement (le verrou par compte reste par e-mail).
- Aucune correction limitée au projet : l'adresse réelle n'existe pas au-delà de `docker-proxy`, et relâcher la limite
  pour `172.23.0.1` affaiblirait la protection (non retenu).
- Correction de fond (hors projet, à planifier avec les autres sites) : activer l'IPv6 sur `traefik-public` (réseau à
  recréer, interruption de tous les sites routés) ou publier Traefik en `network_mode: host`.
- **Repli décidé par le propriétaire** (2026-10-26) : retirer l'enregistrement `AAAA @` chez GoDaddy. L'IPv4 a été
  revérifié de bout en bout le 2026-10-26 (sondes externes, redirections, certificats). À conserver : `A @ 76.13.44.177`,
  `CNAME www heliostores.com`, NS et SOA. Aucun changement sur le serveur : son adresse IPv6 et le réseau des autres
  sites restent tels quels. Les visiteurs en double pile passent par l'IPv4 et chacun retrouve sa propre limite.
  **Non exécuté** : aucun accès GoDaddy autorisé n'est disponible ici.
- **Rétablissement de l'AAAA** (plus tard), seulement quand l'adresse réelle des visiteurs IPv6 parvient à Traefik
  (IPv6 sur le réseau commun ou Traefik en `network_mode: host`, décision commune à tous les sites). Test préalable :
  depuis deux clients IPv6 distincts, vérifier dans un journal d'accès Traefik temporaire que chacun apparaît avec sa
  propre adresse, et non `172.23.0.1`. Ensuite seulement, recréer `AAAA @ 2a02:4780:7:f4ca::1` et revérifier HTTPS en
  IPv6.

Redéploiement : Traefik ne route que les conteneurs « healthy » ; pendant le redémarrage de `heliostores-prod-app`
(environ une minute) le site répond 404. Redéployer hors des heures d'affluence.

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
avec une adresse `@test.invalid` ; l'administration n'a **pas** de suppression de devis : la supprimer en base
(`DELETE FROM "EmailOutbox" WHERE "toEmail" = '…'; DELETE FROM "Quote" WHERE email = '…';`) puis effacer son visuel
`quotes/<visualKey>` dans le volume des médias — ou mieux, tester sur la préproduction.

Avant l'ouverture DNS, les contrôles HTTPS se font depuis le serveur en forçant la résolution :
`curl --resolve heliostores.com:443:76.13.44.177 https://heliostores.com/…` (navigateur :
`--host-resolver-rules="MAP heliostores.com 76.13.44.177"`).

## 5 bis. Suivi des demandes sans SMTP

**Compte administrateur** (créé le 2026-10-26 par `pnpm admin:bootstrap`, mot de passe aléatoire) :
- connexion : `https://heliostores.com/compte/connexion` ;
- compte : `reda.boutaa@gmail.com`, rôle ADMIN ;
- mot de passe initial : `/root/heliostores-admin-bootstrap.txt` (root, 0600, hors dépôt), à lire en SSH ;
- changement : une fois connecté, Mon compte → Sécurité → « Changer le mot de passe ». Les autres sessions sont
  fermées ; supprimer ensuite le fichier (`shred -u /root/heliostores-admin-bootstrap.txt`) ;
- autre administrateur : `cd /opt/pergola && docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm -it migrate pnpm admin:bootstrap`
  (saisie masquée). Le lien « mot de passe oublié » ne fonctionne pas sans SMTP.

**Messagerie au 2026-10-26** :
- adresse affichée au public : `contact@heliostores.com` (Réglages) ;
- boîte de réception : **aucune**, le domaine n'a pas d'enregistrement MX, donc rien n'arrive à cette adresse ;
- envoi : **aucun SMTP HELIOSTORES** sur le serveur (`MAIL_PROVIDER=hold`) ; aucun service d'un autre projet n'est
  emprunté ;
- les mentions légales et la confidentialité gardent `karim_ajaji@hotmail.com`, adresse joignable de l'éditeur.

**Suivi manuel, chaque jour ouvré** (aucun e-mail n'est envoyé ni promis ; le visiteur voit la référence de sa
demande, le délai de livraison et l'adresse de contact) :
1. Administration → tableau de bord : compteurs « devis nouveaux » et « contacts nouveaux ».
2. Devis : ouvrir chaque demande « Nouveau ». On y trouve les coordonnées, le produit et la configuration, la
   visualisation, le PDF et l'origine. La passer « En étude » et répondre au prospect depuis sa propre messagerie.
3. Contacts (contact et rappel), puis Conversations (chat).
4. E-mails : les messages en attente montrent ce qui aurait été envoyé. « Abandonner » écarte ceux qui sont devenus
   inutiles.

**Raccordement futur d'une messagerie** :
1. Créer la boîte `contact@heliostores.com` chez un fournisseur choisi par le propriétaire (MX, SPF, DKIM et DMARC
   dans la zone GoDaddy).
2. Déposer les paramètres SMTP dans `.env.heliostores-prod` (`MAIL_PROVIDER=smtp`, `SMTP_*`, `MAIL_FROM`).
3. Fixer `MAIL_SEND_AFTER=<date ISO du raccordement>` : les messages antérieurs ne partent jamais seuls. Les revoir
   dans Administration → E-mails, « Réessayer » ceux à envoyer, « Abandonner » les autres.
4. Déployer (§ 2 bis), puis tester l'envoi et la réception avec un destinataire contrôlé.

`ADMIN_NOTIFICATION_EMAIL=contact@heliostores.com` est déjà en place ; `MAIL_SEND_AFTER` vaut aujourd'hui
`2026-10-26T12:51:29Z`.

## 6. Sauvegardes et restauration

- Sauvegarde : `PG_CONTAINER=heliostores-prod-postgres POSTGRES_USER=heliostores POSTGRES_DB=heliostores MEDIA_VOLUME=heliostores_prod_uploads bash scripts/backup.sh backups/production && chmod 600 backups/production/*`.
  À planifier (cron quotidien) et à copier hors du VPS : **non planifié à ce jour** (aucune destination externe fournie).
- Tâches planifiées **installées le 2026-10-26** (autorisation du propriétaire), `/etc/cron.d/heliostores-prod`
  (heure de Paris), testées à l'installation (purge : 0 conversation ; sauvegarde `db_20261026_121430` /
  `media_20261026_121430`, sommes de contrôle OK, 57 tables) :
  ```
  15 4 * * * root flock -n /run/heliostores-prod-purge.lock docker exec heliostores-prod-worker pnpm exec tsx scripts/purge-conversations.ts >> /var/log/heliostores-prod-purge.log 2>&1
  45 4 * * * root flock -n /run/heliostores-prod-backup.lock bash -c 'cd /opt/pergola && umask 077 && PG_CONTAINER=heliostores-prod-postgres POSTGRES_USER=heliostores POSTGRES_DB=heliostores MEDIA_VOLUME=heliostores_prod_uploads bash scripts/backup.sh backups/production && chmod 600 backups/production/* && find backups/production -maxdepth 1 -type f \( -name "db_*.dump" -o -name "media_*.tar.gz" -o -name "checksums_*.txt" \) -mtime +14 -delete' >> /var/log/heliostores-prod-backup.log 2>&1
  ```
  Journaux : `/var/log/heliostores-prod-{purge,backup}.log`. Les sauvegardes restent sur le VPS (aucune copie externe).
  Horaires en **heure de Paris** (fuseau du serveur `Europe/Paris`, CET/CEST) : purge à 04:15, sauvegarde à 04:45.
  Revérifié le 2026-10-26 : fichier unique, aucun doublon (`cron.d`, crontab root, timers systemd), service cron
  actif. Restauration isolée de `db_20261026_132425.dump` (conteneur sans réseau) : 31 familles, 196 médias,
  16 migrations, 4 pages publiées.
  La purge du chat (180 j après clôture, 365 j sans activité) est annoncée dans la politique de confidentialité.
- Conservation annoncée des demandes de devis, contact et rappel sans suite : 3 ans au plus après le dernier contact.
  Aucune purge automatique ni suppression dans l'administration : revue manuelle (au moins annuelle) en base.
- Vérification isolée (aucun effet sur les bases en service) :
  ```bash
  docker run -d --rm --name heliostores-restore-check --network none -e POSTGRES_USER=check -e POSTGRES_PASSWORD=check -e POSTGRES_DB=check --tmpfs /var/lib/postgresql/data postgres:16-alpine
  docker exec -i heliostores-restore-check pg_restore --no-owner -U check -d check < backups/…/db_<horodatage>.dump
  docker exec heliostores-restore-check psql -U check -d check -Atc 'select count(*) from "ProductFamily"'
  docker stop heliostores-restore-check
  ```

## 6 ter. Médias : variantes d'images

Après un import de médias, produire la variante 1080 px (écrans mobiles haute densité) ; l'original et la variante
640 px ne sont pas modifiés. Le worker ne monte pas le volume des médias : passer par le service `migrate`.
```bash
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps migrate pnpm media:variants          # simulation
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps migrate pnpm media:variants --apply  # idempotent
```
Suivi commercial : Administration → Suivi par origine (montant HT encaissé saisi sur chaque devis gagné).

**Visuels du carrousel de l'accueil** (un par famille ; manifeste `src/server/media/home-visuals.ts`) : visualisations
générées fournies par le client, originaux dans `inputs/heliostores/homepage/` (hors Git et hors Docker, jamais
modifiés). L'import produit WebP et AVIF en 640, 1080 px et largeur d'origine, sous des noms publics descriptifs, et
enregistre provenance, empreinte et cadrage (`focus`). Sans visuel importé, le carrousel reprend le visuel principal du
premier modèle de chaque famille. Après un changement de cadrage ou de texte alternatif dans le manifeste, relancer
l'import (métadonnées seulement si l'original n'a pas changé).
```bash
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps \
  -v /opt/pergola/inputs/heliostores/homepage:/staging:ro migrate node_modules/.bin/tsx scripts/import-home-visuals.ts --dir /staging          # aperçu
docker compose -f docker/compose.production.yml --env-file .env.heliostores-prod run --rm --no-deps \
  -v /opt/pergola/inputs/heliostores/homepage:/staging:ro migrate node_modules/.bin/tsx scripts/import-home-visuals.ts --dir /staging --apply  # idempotent
```
Légendes publiques : les photos fournisseur autorisées ne portent plus de mention générique « visuel du fabricant, non
contractuel » ; les visualisations de l'accueil sont légendées « Visualisation » ; les rendus 3D et visuels joints aux
devis gardent « visualisation non contractuelle » ; crédits et sources restent dans la médiathèque (non publiés).

## 6 bis. Identité et pages légales

Mise à jour du 2026-10-26 (après-midi), à la demande du propriétaire :
- coordonnées commerciales : `contact@heliostores.com`, téléphone retiré des Réglages ; la présentation commerciale
  montre « HELIOSTORES, 59650 Villeneuve-d'Ascq, France » sans rue ;
- mentions légales : identité de l'éditeur conservée (THYSENS, siège, téléphone en texte simple, sans lien d'appel,
  e-mail joignable) ;
- page `livraison-installation` publiée avec le délai fourni et sans condition inventée.
Sources hors dépôt : `private/legal-2026-10-26/apply-contact.sql` (versions précédentes `*.v1.md`).

Réglages (`SiteSettings`) et pages `mentions-legales`, `confidentialite`, `cookies` publiés le 2026-10-26 en base de
production (sources hors dépôt : `private/legal-2026-10-26/`, avec le SQL appliqué ; trace `AuditLog`
`content.publish`). Identité : fournie par le propriétaire, croisée avec recherche-entreprises.api.gouv.fr et le BODACC.
Numéro de TVA intracommunautaire non publié (VIES indisponible pour la France le 2026-10-26) : le vérifier sur
`https://ec.europa.eu/taxation_customs/vies/`, puis le saisir (Administration → Réglages) et l'ajouter aux mentions.
CGV et Livraison et installation restent en brouillon (noindex) tant qu'aucune condition n'est fournie.

## 7. Retour arrière

- **Version applicative** : remettre l'`IMAGE_TAG` précédent (avant le 2026-10-26 10:45 UTC : `e2afbed497d1` ;
  copie de l'environnement d'avant bascule : `backups/production/env_heliostores-prod_20261026_pre-bascule`) puis
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
