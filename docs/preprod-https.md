# Préproduction publique HTTPS — demo-elios.beaverdata.eu

**Active depuis le 2026-10-20** : certificat Let's Encrypt (CN `demo-elios.beaverdata.eu`, expire le 2027-01-18, renouvelé
par Traefik), image `969d583`.

Contrôles externes faits par l'URL publique :
- sans identifiant ou avec un mauvais identifiant : 401, en IPv4 comme en IPv6 ;
- HTTP redirigé en 301 vers HTTPS ;
- pages servies en 200 : accueil, catalogue, fiche (5 photos chargées), configurateur standard (canvas 3D), sur-mesure (3D),
  inscription, déconnexion et connexion client ;
- `/admin` refusé à un client ;
- devis sur-mesure : visuel 3D joint, visible dans le compte, PDF servi ;
- aucune requête `http://`, aucune réponse ≥ 400, aucune erreur JavaScript ;
- `X-Forwarded-For` forgé ignoré : 401 ×3 puis 429 ;
- ports 3401, 5432, 5433, 8025 et 1025 fermés sur l'IP publique.

Le Traefik existant sur le VPS gère les ports 80/443, les certificats Let's Encrypt (défi TLS-ALPN) et la redirection de HTTP
vers HTTPS. Aucun autre site n'est modifié : le routeur `elios-solar` est déclaré par les labels du seul conteneur `elios-solar-app`.

## DNS (zone beaverdata.eu chez Hostinger)

| Type | Nom | Valeur | TTL |
|---|---|---|---|
| A | `demo-elios` | `76.13.44.177` | 300 |
| AAAA | `demo-elios` | `2a02:4780:7:f4ca::1` | 300 |

## Configuration (`.env.prod`, jamais commité)

```
TRAEFIK_ENABLE=true
SITE_DOMAIN=demo-elios.beaverdata.eu
NEXT_PUBLIC_SITE_URL=https://demo-elios.beaverdata.eu
BETTER_AUTH_URL=https://demo-elios.beaverdata.eu
SITE_INDEXABLE=false
PAYMENT_PROVIDER=demo
TRUSTED_PROXIES=<passerelle elios_solar_internal>,<IP du conteneur traefik>
REVIEW_BASIC_AUTH='revue-client:$apr1$…'      # ligne htpasswd ; mot de passe en clair dans /root/elios-solar-revue.txt (600)
```

Les URL sont lues à l'exécution côté serveur ; les bundles client n'en contiennent aucune. Un changement de domaine demande
seulement `docker compose … up -d --no-deps --no-build app worker`. Les cookies d'authentification deviennent
`__Secure-…`, avec `Secure`, `HttpOnly` et `SameSite=Lax`. Les redirections (paiement simulé, e-mails, liens) visent le domaine.

## Protections

- **Identifiant et mot de passe de revue** : middleware basic auth de Traefik. L'en-tête `Authorization` est retiré avant l'app.
  Sans `REVIEW_BASIC_AUTH`, le middleware est invalide et le routeur reste fermé.
- **Non indexable** : en-tête `X-Robots-Tag: noindex, nofollow, noarchive`, `robots.txt` en `Disallow: /`, sitemap vide et
  balise meta `noindex` (`SITE_INDEXABLE=false`).
- **Services internes** : PostgreSQL, le worker et Mailpit ne sont pas publiés. L'app reste liée à `127.0.0.1:3401` pour le tunnel.
- **Paiement** : `PAYMENT_PROVIDER=demo`, aucune clé Stripe.

## Changer ou révoquer l'accès de revue

```bash
cd /opt/pergola
umask 077; PW=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)
printf 'Identifiant : revue-client\nMot de passe : %s\n' "$PW" > /root/elios-solar-revue.txt
H=$(openssl passwd -apr1 "$PW"); unset PW
sed -i '/^REVIEW_BASIC_AUTH=/d' .env.prod; printf "REVIEW_BASIC_AUTH='revue-client:%s'\n" "$H" >> .env.prod
docker compose -f docker/compose.prod.yml --env-file .env.prod up -d --no-deps app
```

## Limites

- Le tunnel SSH (`http://127.0.0.1:3401`) sert désormais au diagnostic. La connexion par le tunnel est refusée, car l'origine
  n'est plus de confiance et les cookies sont `Secure`. Connectez-vous par l'URL HTTPS.
- Pour une recette navigateur complète contre la préproduction (`scripts/e2e-docker.sh`), il faut remettre temporairement les URL
  `http://127.0.0.1:3401`, ou lancer la recette en CI, qui utilise son propre environnement.
- L'adresse du conteneur Traefik (`TRUSTED_PROXIES`) n'est pas fixe. Si elle change, toutes les requêtes publiques partagent le
  quota de l'adresse de Traefik : la règle devient plus stricte, sans possibilité d'usurpation. Il faut alors mettre l'adresse à jour.
- Un seul identifiant de revue est partagé. Chaque visiteur crée ensuite son propre compte client fictif.
