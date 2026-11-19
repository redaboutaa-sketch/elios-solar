# Fonctions communes de la recette HELIOSTORES (sourcées par les scripts de scripts/recette/).
# Aucun secret n'est affiché : les identifiants sont lus dans les fichiers d'environnement et passés par variables.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RECETTE_DIR="$ROOT/private/recette"            # hors Git (/private/ est ignoré)
STATE_FILE="$RECETTE_DIR/current.env"          # environnement isolé en cours (un seul à la fois)
LOCK_FILE="${RECETTE_LOCK_FILE:-/tmp/heliostores-recette.lock}"
DEV_PG_CONTAINER="${RECETTE_PG_CONTAINER:-elios-solar-dev-postgres}"   # PostgreSQL de développement (127.0.0.1:5433)
PROD_PG_CONTAINER="heliostores-prod-postgres"
PROD_UPLOADS_VOLUME="heliostores_prod_uploads"
RECETTE_PORT="${RECETTE_PORT:-3410}"
# « localhost » (boucle locale, jamais public) : avec -H 127.0.0.1, Next normalise l'URL de la requête en « localhost »
# et traite la réécriture des langues (/es/… → /…) comme externe, perdant l'en-tête de langue (constaté le 2026-11-19)
RECETTE_URL="http://localhost:$RECETTE_PORT"
mkdir -p "$RECETTE_DIR"; chmod 700 "$RECETTE_DIR"

log() { printf '[recette %s] %s\n' "$(date +%H:%M:%S)" "$*" >&2; }
die() { log "ERREUR : $*"; exit 1; }

# Verrou exclusif : une seule campagne / un seul environnement isolé à la fois (descripteur 9 tenu par l'appelant).
take_lock() {
  exec 9>"$LOCK_FILE"
  flock -n 9 || die "une autre campagne de recette est en cours (verrou $LOCK_FILE)"
}

# URL de la base de développement (identifiants du fichier .env local, jamais affichés), base remplacée par $1.
dev_db_url() {
  local base; base="$(grep -E '^DATABASE_URL=' "$ROOT/.env" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  [ -n "$base" ] || die "DATABASE_URL absent de .env"
  node -e 'const u=new URL(process.argv[1]); u.pathname="/"+process.argv[2]; u.search="?schema=public"; process.stdout.write(u.toString())' "$base" "$1"
}

# psql dans le conteneur de développement (SQL sur l'entrée standard).
dev_psql() { docker exec -i "$DEV_PG_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "${1:-$POSTGRES_DB}" -At -F"|"' sh "${1:-}"; }
# psql en LECTURE SEULE sur la production (transaction read only imposée).
prod_psql_ro() { docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on" "$PROD_PG_CONTAINER" sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F"|"'; }

state_get() { [ -f "$STATE_FILE" ] && grep -E "^$1=" "$STATE_FILE" | tail -1 | cut -d= -f2- || true; }

# Arrête UNIQUEMENT le processus dont le PID est consigné par la recette, après vérification de sa ligne de commande.
stop_recorded_server() {
  local pid; pid="$(state_get APP_PID)"
  [ -n "$pid" ] || return 0
  # vérification : PID consigné, lancé depuis ce dépôt, à l'écoute sur le port de recette (Next renomme son processus
  # « next-server », la ligne de commande ne suffit pas)
  if kill -0 "$pid" 2>/dev/null && [ "$(readlink "/proc/$pid/cwd")" = "$ROOT" ] && ss -ltnp 2>/dev/null | grep -qE "(127\.0\.0\.1|\[::1\]):$RECETTE_PORT .*pid=$pid,"; then
    log "arrêt du serveur de recette (PID $pid)"
    kill "$pid"; for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done
  fi
}
