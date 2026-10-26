#!/usr/bin/env bash
# Déploiement de la production HELIOSTORES sans fenêtre sans instance saine (docs/production-runbook.md § 2 bis).
#   scripts/deploy-production.sh <IMAGE_TAG>     (images elios-solar/{app,tools}:<IMAGE_TAG> déjà construites)
# 1. migrations (additives : l'ancienne version reste compatible) ; 2. relais `app-relay` sur la nouvelle image, attendu
# sain ; 3. recréation de `app` et du worker, `app` attendu sain ; 4. retrait du relais. Ne touche qu'au projet
# heliostores-prod (aucune modification de Traefik ni des autres piles). Échec avant l'étape 3 : l'ancienne `app` sert
# toujours, IMAGE_TAG est remis à sa valeur précédente.
set -euo pipefail
cd "$(dirname "$0")/.."
TAG="${1:?IMAGE_TAG requis}"
ENV=.env.heliostores-prod
DC=(docker compose -f docker/compose.production.yml --env-file "$ENV")
docker image inspect "elios-solar/app:$TAG" "elios-solar/tools:$TAG" >/dev/null
PREV="$(sed -n 's/^IMAGE_TAG=//p' "$ENV")"
log() { echo "[deploy $(date +%T)] $*"; }
wait_healthy() { # conteneur, délai max (s)
  local c="$1" t="${2:-180}" s
  for _ in $(seq 1 "$t"); do
    s="$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo absent)"
    [ "$s" = healthy ] && return 0
    [ "$s" = unhealthy ] && break
    sleep 1
  done
  log "$c : état « $s »"; return 1
}
restore() { sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$PREV/" "$ENV"; "${DC[@]}" --profile relay rm -sf app-relay >/dev/null 2>&1 || true; }
log "version précédente : $PREV → nouvelle : $TAG"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$TAG/" "$ENV"
trap 'log "ÉCHEC avant bascule : retour à $PREV"; restore' ERR
"${DC[@]}" run --rm migrate
# Traefik refuse un routeur défini différemment par deux conteneurs : si les labels changent, pas de recouvrement
# possible (recréation directe, coupure de quelques secondes le temps de la sonde de démarrage).
same_labels() {
  python3 - "$(docker inspect -f '{{json .Config.Labels}}' heliostores-prod-app 2>/dev/null || echo '{}')" "$("${DC[@]}" config --format json)" <<'PY'
import json, sys
cur = {k: v for k, v in json.loads(sys.argv[1]).items() if k.startswith("traefik.")}
# `config` garde l'échappement « $$ » de compose ; le conteneur porte la valeur finale « $ »
new = {k: v.replace("$$", "$") for k, v in json.loads(sys.argv[2])["services"]["app"].get("labels", {}).items() if k.startswith("traefik.")}
sys.exit(0 if cur and cur == new else 1)
PY
}
if ! same_labels; then
  trap - ERR
  log "labels Traefik modifiés : recréation directe (coupure courte annoncée, sans recouvrement)"
  "${DC[@]}" up -d --no-deps app worker
  wait_healthy heliostores-prod-app
  log "terminé : $(curl -s "http://127.0.0.1:$(sed -n 's/^APP_PORT=//p' "$ENV" | grep . || echo 3402)/api/health")"
  exit 0
fi
"${DC[@]}" --profile relay up -d --no-deps app-relay
wait_healthy heliostores-prod-app-relay
sleep 5 # prise en compte par Traefik
trap - ERR
log "relais sain : recréation de app et du worker"
"${DC[@]}" up -d --no-deps app worker
wait_healthy heliostores-prod-app || { log "app non saine : le relais (nouvelle version) reste en service ; voir runbook § 7"; exit 1; }
sleep 5
# vidange du relais : sa sonde échoue (fichier /tmp/drain), Traefik le retire du routage pendant qu'il répond encore ;
# il n'est arrêté qu'ensuite (un conteneur disparu avant la mise à jour de Traefik laisse des connexions sans réponse)
docker exec heliostores-prod-app-relay touch /tmp/drain
for _ in $(seq 1 30); do [ "$(docker inspect -f '{{.State.Health.Status}}' heliostores-prod-app-relay)" = unhealthy ] && break; sleep 1; done
sleep 5
"${DC[@]}" --profile relay rm -sf app-relay
log "terminé : $(curl -s "http://127.0.0.1:$(sed -n 's/^APP_PORT=//p' "$ENV" | grep . || echo 3402)/api/health")"
