#!/usr/bin/env bash
# Recette navigateur COMPLÈTE contre la pile Docker (une seule campagne, sans relance).
#   scripts/e2e-docker.sh [fichier-env] [arguments playwright…]
# - lit les identifiants PostgreSQL dans le fichier d'environnement (défaut : .env.prod) sans les afficher ;
# - joint la base par l'IP interne du conteneur (PostgreSQL n'est pas publié sur l'hôte) ;
# - vérifie que l'application répond et affiche le commit exécuté avant de lancer la suite.
set -euo pipefail
ENV_FILE="${1:-.env.prod}"; shift || true
APP_URL="${E2E_BASE_URL:-http://127.0.0.1:${APP_PORT_OVERRIDE:-3401}}"
PG_CONTAINER="${PG_CONTAINER:-elios-solar-postgres}"
[ -f "$ENV_FILE" ] || { echo "fichier d'environnement introuvable : $ENV_FILE" >&2; exit 1; }
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PGU="$(val POSTGRES_USER)"; PGU="${PGU:-elios}"
PGP="$(val POSTGRES_PASSWORD)"
PGD="$(val POSTGRES_DB)"; PGD="${PGD:-elios_solar}"
[ -n "$PGP" ] || { echo "POSTGRES_PASSWORD absent de $ENV_FILE" >&2; exit 1; }
PG_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' "$PG_CONTAINER" | awk '{print $1}')"
[ -n "$PG_IP" ] || { echo "IP du conteneur $PG_CONTAINER introuvable" >&2; exit 1; }
health="$(curl -fsS "$APP_URL/api/health")" || { echo "application injoignable sur $APP_URL" >&2; exit 1; }
echo "Application : $APP_URL — $(echo "$health" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const h=JSON.parse(s);console.log(`commit ${h.commit}, migration ${h.lastMigration}, base ${h.db}`)})')"
export DATABASE_URL="postgresql://${PGU}:${PGP}@${PG_IP}:5432/${PGD}?schema=public"
export E2E_BASE_URL="$APP_URL" E2E_NO_SERVER=1
exec pnpm exec playwright test "$@"
