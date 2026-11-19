#!/usr/bin/env bash
# /recette-site : campagne COMPLÈTE de recette sur un environnement isolé (une seule à la fois, verrou exclusif).
#   scripts/recette/campaign.sh [--source prod|seed] [--reuse] [--keep] [--only unit,integration,e2e,recette,audit]
#     --source  copie anonymisée de la production (défaut) ou base neuve du jeu d'essai
#     --reuse   réutilise l'environnement isolé déjà démarré (scripts/recette/env.sh up)
#     --keep    laisse l'environnement isolé démarré à la fin (exploration par le navigateur piloté)
# Aucune relance automatique ; chaque suite s'exécute une fois ; rapport : private/recette/runs/<id>/reports/rapport.md
# (PRIVÉ) et resume-public.md (publiable). Nettoyage : uniquement les ressources créées par la campagne.
source "$(dirname "$0")/lib.sh"
SOURCE="prod" REUSE=0 KEEP=0 ONLY="unit,integration,e2e,recette,audit"
while [ $# -gt 0 ]; do case "$1" in --source) SOURCE="$2"; shift 2;; --reuse) REUSE=1; shift;; --keep) KEEP=1; shift;; --only) ONLY="$2"; shift 2;; *) die "option inconnue : $1";; esac; done
want() { [[ ",$ONLY," == *",$1,"* ]]; }
take_lock
cd "$ROOT"
if [ "$REUSE" = 1 ]; then [ -f "$STATE_FILE" ] || die "--reuse : aucun environnement isolé démarré"; else
  [ ! -f "$STATE_FILE" ] || die "un environnement isolé existe déjà : --reuse, ou scripts/recette/env.sh down"
  RECETTE_LOCK_HELD=1 bash "$ROOT/scripts/recette/env.sh" up --source "$SOURCE" 9>&- || die "environnement isolé indisponible"
fi
cleanup() {
  git -C "$ROOT" checkout -- tests/e2e/screenshots 2>/dev/null || true
  rm -rf "$ROOT/test-results" "$ROOT/playwright-report"
  [ "$KEEP" = 1 ] || bash "$ROOT/scripts/recette/env.sh" down 9>&- || true
}
trap cleanup EXIT
RUN="$(state_get RUN_DIR)"; ID="$(state_get ID)"; DB="$(state_get DB)"
OUT="$RUN/reports"; mkdir -p "$OUT/captures"
set -a; source "$RUN/app.env"; set +a
export E2E_BASE_URL="$RECETTE_URL" E2E_NO_SERVER=1 RECETTE_REPORT_DIR="$OUT"
COMMIT="$(git rev-parse --short=12 HEAD)"; DIRTY=false; [ -n "$(git status --porcelain --untracked-files=no)" ] && DIRTY=true
VERSIONS="$(echo "SELECT string_agg(\"familySlug\" || coalesce(nullif(':' || \"variantKey\", ':'), '') || ' v' || version, ', ' ORDER BY \"familySlug\", \"variantKey\") FROM \"SupplierPriceList\" WHERE scope = 'GRID' AND status = 'ACTIVE' AND \"amountRole\" = 'VENTE';" | dev_psql "$DB")"
suites=()
add_suite() { suites+=("{\"id\":\"$1\",\"label\":\"$2\",\"kind\":\"$3\",\"file\":\"$4\",\"planned\":$5,\"reason\":\"${6:-}\"}"); }

if want unit; then
  log "suite : tests unitaires"
  pnpm -s exec vitest run tests/unit --reporter=json --outputFile="$OUT/vitest-unit.json" >"$OUT/vitest-unit.log" 2>&1 || true
  add_suite unit "Unitaires (vitest)" vitest "$OUT/vitest-unit.json" true
else add_suite unit "Unitaires (vitest)" vitest "" false "non demandé (--only)"; fi

if want integration; then
  IT_DB="recette_it_${ID}"; echo "IT_DB=$IT_DB" >>"$STATE_FILE"
  echo "CREATE DATABASE $IT_DB;" | dev_psql
  log "suite : tests d'intégration (base $IT_DB)"
  DATABASE_URL="$(dev_db_url "$IT_DB")" DATABASE_URL_TEST="$(dev_db_url "$IT_DB")" VITEST_DB_SETUP=1 \
    pnpm -s exec vitest run tests/integration --reporter=json --outputFile="$OUT/vitest-integration.json" >"$OUT/vitest-integration.log" 2>&1 || true
  add_suite integration "Intégration (vitest, base dédiée)" vitest "$OUT/vitest-integration.json" true
else add_suite integration "Intégration (vitest, base dédiée)" vitest "" false "non demandé (--only)"; fi

if want e2e; then
  log "suite : parcours navigateur tests/e2e (desktop 1440 + mobile 390)"
  PLAYWRIGHT_JSON_OUTPUT_NAME="$OUT/playwright-e2e.json" pnpm -s exec playwright test --reporter=json --output "$OUT/e2e-traces" >"$OUT/playwright-e2e.log" 2>&1 || true
  add_suite e2e "Parcours navigateur (tests/e2e)" playwright "$OUT/playwright-e2e.json" true
else add_suite e2e "Parcours navigateur (tests/e2e)" playwright "" false "non demandé (--only)"; fi

if want audit; then
  log "suite : audit des tarifs (A, B, C)"
  bash "$ROOT/scripts/recette/audit-tarifs/run.sh" --out "$OUT/audit-tarifs" --levels ABC --prod-a 9>&- >"$OUT/audit-tarifs.log" 2>&1 || true
  REF="$OUT/audit-tarifs/reference.json"
  add_suite audit-ref "Audit tarifs — extraction PDF" audit-ref "$REF" true
  add_suite audit-a-recette "Audit tarifs A — PDF → base (copie)" audit-a "$OUT/audit-tarifs/ecarts-A-recette.json" true
  add_suite audit-a-prod "Audit tarifs A — PDF → base (production, lecture seule)" audit-a "$OUT/audit-tarifs/ecarts-A-prod.json" true
  add_suite audit-b "Audit tarifs B — référence → moteur" audit-b "$OUT/audit-tarifs/engine-B.json" true
  add_suite audit-c "Audit tarifs C — référence → navigateur → devis" playwright "$OUT/audit-tarifs/playwright-recette.json" true
else for s in audit-ref audit-a-recette audit-a-prod audit-b audit-c; do add_suite "$s" "Audit tarifs ($s)" audit-ref "" false "non demandé (--only)"; done; fi

if want recette; then
  log "suite : contrôles publics et visuels (tests/recette)"
  RECETTE_MODE=isolated pnpm -s exec playwright test -c playwright.recette.config.ts tests/recette/controle-public.spec.ts tests/recette/visuel.spec.ts >"$OUT/playwright-recette.log" 2>&1 || true
  [ -f "$OUT/playwright-recette.json" ] && mv "$OUT/playwright-recette.json" "$OUT/playwright-publics.json"
  add_suite recette "Contrôles publics et visuels (tests/recette)" playwright "$OUT/playwright-publics.json" true
else add_suite recette "Contrôles publics et visuels (tests/recette)" playwright "" false "non demandé (--only)"; fi

REFSHA="$(python3 -I -c 'import json,sys; print(json.load(open(sys.argv[1]))["document"]["sha256Checked"])' "$OUT/audit-tarifs/reference.json" 2>/dev/null || echo "non extraite")"
printf '{"id":"%s","date":"%s","environment":"isolé (copie %s anonymisée, base %s)","baseUrl":"%s","commit":"%s","dirty":%s,"tariffVersions":"%s","reference":"PDF sha256 %s","suites":[%s]}\n' \
  "$ID" "$(date -Iseconds)" "$SOURCE" "$DB" "$RECETTE_URL" "$COMMIT" "$DIRTY" "$VERSIONS" "$REFSHA" "$(IFS=,; echo "${suites[*]}")" >"$OUT/campaign.json"
NODE_OPTIONS="--require $ROOT/scripts/lib/server-only-shim.cjs" pnpm -s exec tsx scripts/recette/report.ts "$OUT"; rc=$?
log "rapport : $OUT/rapport.md (privé) — résumé publiable : $OUT/resume-public.md"
exit $rc
