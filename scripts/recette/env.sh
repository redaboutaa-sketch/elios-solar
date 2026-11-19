#!/usr/bin/env bash
# Environnement de recette ISOLÉ (copie anonymisée de la production, ou base neuve du jeu d'essai).
#   scripts/recette/env.sh up [--source prod|seed] [--no-build]
#   scripts/recette/env.sh status
#   scripts/recette/env.sh down
# - base séparée « recette_<id> » dans le PostgreSQL de développement (127.0.0.1:5433), jamais la production ;
# - copie de la production prise en LECTURE SEULE (pg_dump), données personnelles anonymisées avant tout démarrage ;
# - médias copiés depuis le volume de production (lecture seule) dans le dossier de la campagne ;
# - e-mails capturés localement (MAIL_PROVIDER=log), paiement simulé non public (PAYMENT_PROVIDER=demo), non indexable ;
# - application sur localhost:$RECETTE_PORT seulement (boucle locale, aucun port public) ;
# - « down » ne supprime que les ressources consignées par « up » (base recette_<id>, dossier de la campagne, PID).
source "$(dirname "$0")/lib.sh"
cmd="${1:-status}"; shift || true

up() {
  local source="prod" build=1
  while [ $# -gt 0 ]; do case "$1" in --source) source="$2"; shift 2;; --no-build) build=0; shift;; *) die "option inconnue : $1";; esac; done
  [ ! -f "$STATE_FILE" ] || die "un environnement de recette existe déjà ($(state_get DB)) : scripts/recette/env.sh down"
  local id; id="$(date +%Y%m%d_%H%M%S)"
  local db="recette_$id" run="$RECETTE_DIR/runs/$id"
  mkdir -p "$run"; chmod 700 "$run"
  { echo "ID=$id"; echo "DB=$db"; echo "RUN_DIR=$run"; echo "SOURCE=$source"; echo "PORT=$RECETTE_PORT"; } >"$STATE_FILE"; chmod 600 "$STATE_FILE"
  log "base isolée $db (source : $source)"
  echo "CREATE DATABASE $db;" | dev_psql
  if [ "$source" = "prod" ]; then
    # lecture seule côté production ; aucune option de nettoyage
    docker exec "$PROD_PG_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' | dev_psql "$db" >/dev/null
    dev_psql "$db" <"$ROOT/scripts/recette/anonymize.sql" >/dev/null
    log "copie de la production restaurée et anonymisée"
    # migrations de la version testée, comme scripts/deploy-production.sh avant la bascule (additives)
    DATABASE_URL="$(dev_db_url "$db")" pnpm -s exec prisma migrate deploy >/dev/null
    log "migrations de la version testée appliquées à la copie"
    mkdir -p "$run/uploads"
    docker run --rm -v "$PROD_UPLOADS_VOLUME":/u:ro alpine tar -C /u -cf - . | tar -C "$run/uploads" -xf -
  else
    DATABASE_URL="$(dev_db_url "$db")" pnpm -s exec prisma migrate deploy >/dev/null
    DATABASE_URL="$(dev_db_url "$db")" pnpm -s exec tsx prisma/seed.ts >/dev/null
    mkdir -p "$run/uploads"
  fi
  # environnement de l'application (secrets aléatoires propres à la campagne, fichier 600, jamais affiché)
  umask 077
  cat >"$run/app.env" <<EOF
DATABASE_URL=$(dev_db_url "$db")
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BETTER_AUTH_URL=$RECETTE_URL
NEXT_PUBLIC_SITE_URL=$RECETTE_URL
INTERNAL_APP_URL=$RECETTE_URL
PORT=$RECETTE_PORT
NEXT_PUBLIC_BRAND_NAME=HELIOSTORES
SITE_INDEXABLE=false
SITE_LOCALES=fr,es,nl,de,en
MAIL_PROVIDER=log
ADMIN_NOTIFICATION_EMAIL=admin-recette@test.invalid
PAYMENT_PROVIDER=demo
DEMO_PAYMENT_WEBHOOK_SECRET=$(openssl rand -hex 24)
MEDIA_STORAGE_DIR=$run/uploads
NEXT_TELEMETRY_DISABLED=1
LOG_LEVEL=info
GIT_COMMIT=$(git -C "$ROOT" rev-parse HEAD)$( [ -n "$(git -C "$ROOT" status --porcelain --untracked-files=no)" ] && echo "-modifie" )
BUILD_TIME=$(date -u +%FT%TZ)
EOF
  set -a; source "$run/app.env"; set +a
  # catalogue du code (règles, textes) appliqué à la copie, comme après un déploiement
  pnpm -s exec tsx scripts/catalogue-sync.ts --apply >"$run/catalogue-sync.log" 2>&1 || die "synchronisation du catalogue en échec ($run/catalogue-sync.log)"
  if [ "$build" = 1 ]; then
    log "construction (pnpm build)"
    if ! pnpm -s build >"$run/build.log" 2>&1; then
      # Next.js 16.4.2 interrompt parfois la construction par un avis de sécurité (« Retry the same command ») : une seule
      # nouvelle tentative, consignée ; la mise à jour de sécurité de Next.js reste recommandée (voir le rapport)
      grep -q "SecurityFatalError" "$run/build.log" || die "construction en échec ($run/build.log)"
      mv "$run/build.log" "$run/build-avis-securite.log"; echo "NEXT_SECURITY_NOTICE=1" >>"$STATE_FILE"
      log "avis de sécurité de Next.js : construction relancée une fois (mise à jour de Next.js recommandée)"
      pnpm -s build >"$run/build.log" 2>&1 || die "construction en échec ($run/build.log)"
    fi
  fi
  log "démarrage de l'application sur $RECETTE_URL"
  # processus lancé directement (PID exact consigné ; jamais de recherche par motif pour l'arrêter)
  nohup node "$ROOT/node_modules/next/dist/bin/next" start -H localhost -p "$RECETTE_PORT" >"$run/app.log" 2>&1 9>&- &
  echo "APP_PID=$!" >>"$STATE_FILE"
  for _ in $(seq 1 60); do curl -fsS "$RECETTE_URL/api/health" >/dev/null 2>&1 && break; sleep 1; done
  curl -fsS "$RECETTE_URL/api/health" >"$run/health.json" || die "application injoignable ($run/app.log)"
  log "prête : $(cat "$run/health.json")"
}

down() {
  [ -f "$STATE_FILE" ] || { log "aucun environnement de recette"; return 0; }
  stop_recorded_server
  local db; db="$(state_get DB)"
  if [[ "$db" =~ ^recette_[0-9_]+$ ]]; then
    log "suppression de la base $db"
    printf 'DROP DATABASE IF EXISTS %s WITH (FORCE);\n' "$db" | dev_psql
    local it; it="$(state_get IT_DB)"; [[ "$it" =~ ^recette_it_[0-9_]+$ ]] && printf 'DROP DATABASE IF EXISTS %s WITH (FORCE);\n' "$it" | dev_psql
  fi
  # médias copiés et secrets de la campagne ; les rapports (dossier reports/) sont conservés
  local run; run="$(state_get RUN_DIR)"
  [[ "$run" == "$RECETTE_DIR/runs/"* ]] && rm -rf "$run/uploads" "$run/app.env"
  rm -f "$STATE_FILE"
}

status() {
  [ -f "$STATE_FILE" ] || { echo "aucun environnement de recette"; return 0; }
  grep -vE '^(APP_PID)=' "$STATE_FILE"
  curl -fsS "$RECETTE_URL/api/health" 2>/dev/null || echo "application arrêtée"
}

case "$cmd" in
  # échec de « up » : les ressources déjà créées (base, dossier, processus) sont retirées aussitôt
  up) [ "${RECETTE_LOCK_HELD:-}" = 1 ] || take_lock; trap 'rc=$?; if [ $rc -ne 0 ]; then down; fi' EXIT; up "$@";;
  down) down;;
  status) status;;
  *) die "usage : env.sh up|down|status";;
esac
