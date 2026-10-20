# Préproduction publique HTTPS — demo-elios.beaverdata.eu

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

`NEXT_PUBLIC_SITE_URL` est figée à la construction de l'image : il faut reconstruire l'image `app` après chaque changement.
Les cookies d'authentification deviennent `Secure`, et les redirections (paiement simulé, e-mails, liens) visent le domaine.

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
