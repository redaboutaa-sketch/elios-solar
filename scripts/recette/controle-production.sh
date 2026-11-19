#!/usr/bin/env bash
# /controle-production : contrôle APRÈS DÉPLOIEMENT, public et non destructif.
#   scripts/recette/controle-production.sh [--expect-commit <sha>] [--url https://heliostores.com] [--no-browser]
# - aucune commande, aucun devis, aucun message, aucun paiement ; aucune IP simulée ; aucune connexion ;
# - base de production lue en LECTURE SEULE (identifiant d'un devis existant pour vérifier qu'il reste privé) ;
# - montants attendus calculés depuis la référence PDF privée (indépendante de la base et du moteur).
# Rapport : private/recette/controle-production/<horodatage>/rapport.md (privé) et resume-public.md.
source "$(dirname "$0")/lib.sh"
URL="https://heliostores.com" EXPECT="" BROWSER=1 PREPROD="https://demo-elios.beaverdata.eu"
while [ $# -gt 0 ]; do case "$1" in --expect-commit) EXPECT="$2"; shift 2;; --url) URL="$2"; shift 2;; --no-browser) BROWSER=0; shift;; *) die "option inconnue : $1";; esac; done
cd "$ROOT"
TS="$(date +%Y%m%d_%H%M%S)"; OUT="$RECETTE_DIR/controle-production/$TS"; mkdir -p "$OUT/captures"; chmod 700 "$OUT"
CHK="$OUT/controles-http.tsv"; : >"$CHK"
ok() { printf 'Réussi\t%s\t%s\n' "$1" "${2:-}" >>"$CHK"; }
ko() { printf 'Échoué\t%s\t%s\n' "$1" "${2:-}" >>"$CHK"; }
nt() { printf 'Non testé\t%s\t%s\n' "$1" "${2:-}" >>"$CHK"; }
check() { if eval "$2"; then ok "$1" "${3:-}"; else ko "$1" "${3:-}"; fi; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@"; }
hdr() { curl -sI --max-time 20 "$1" | tr -d '\r' | grep -i "^$2:" | cut -d' ' -f2- || true; }

log "santé et commit exécuté"
HEALTH="$(curl -fsS --max-time 20 "$URL/api/health" || echo '{}')"; echo "$HEALTH" >"$OUT/health.json"
RUNNING="$(node -e 'try{const h=JSON.parse(process.argv[1]);process.stdout.write(`${h.status}|${h.db}|${h.commit}`)}catch{process.stdout.write("||")}' "$HEALTH")"
check "santé /api/health (application et base)" '[[ "$RUNNING" == ok\|ok\|* ]]' "$RUNNING"
if [ -n "$EXPECT" ]; then check "commit exécuté = commit attendu ($EXPECT)" '[[ "${RUNNING##*|}" == "$EXPECT"* || "$EXPECT" == "${RUNNING##*|}"* ]]' "exécuté : ${RUNNING##*|}"; else nt "commit attendu" "aucun commit attendu fourni (--expect-commit)"; fi
log "pages, indexation, redirections"
check "accueil 200 sans X-Robots-Tag" '[ "$(code "$URL/")" = 200 ] && [ -z "$(hdr "$URL/" x-robots-tag)" ]'
check "www → domaine principal (301)" '[ "$(code "https://www.${URL#https://}/pergolas")" = 301 ]'
check "robots.txt et sitemap.xml servis" '[ "$(code "$URL/robots.txt")" = 200 ] && [ "$(code "$URL/sitemap.xml")" = 200 ]'
check "espace client non indexable (noindex)" '[[ "$(hdr "$URL/compte" x-robots-tag)" == *noindex* ]]'
check "administration : redirection vers la connexion" '[ "$(code "$URL/admin")" = 307 ]'
log "documents privés (devis existant, sans session)"
QID="$(echo 'SELECT id FROM "Quote" ORDER BY "createdAt" DESC LIMIT 1;' | prod_psql_ro 2>/dev/null || true)"
if [ -n "$QID" ]; then
  check "PDF d'un devis existant inaccessible sans session" '[[ "$(code "$URL/api/devis/$QID/pdf")" =~ ^(401|403|404)$ ]]' "code $(code "$URL/api/devis/$QID/pdf")"
  check "visuel d'un devis existant inaccessible sans session" '[[ "$(code "$URL/api/devis/$QID/visuel")" =~ ^(401|403|404)$ ]]'
else nt "documents d'un devis existant" "aucun devis en base ou base illisible"; fi
log "paiement et préproduction"
PAY="$(docker exec heliostores-prod-app printenv PAYMENT_PROVIDER 2>/dev/null || echo '?')"
check "paiement désactivé en production" '[ "$PAY" = disabled ]' "PAYMENT_PROVIDER=$PAY"
check "préproduction protégée (401 sans identifiant, y compris robots.txt)" '[ "$(code "$PREPROD/")" = 401 ] && [ "$(code "$PREPROD/robots.txt")" = 401 ]'
if [ -n "${E2E_HTTP_USER:-}" ]; then
  NOIDX="$(printf 'user = "%s:%s"\n' "$E2E_HTTP_USER" "${E2E_HTTP_PASSWORD:-}" | curl -sI -K - "$PREPROD/" | tr -d '\r' | grep -i '^x-robots-tag:' || true)"
  check "préproduction non indexable (X-Robots-Tag noindex)" '[[ "$NOIDX" == *noindex* ]]'
else nt "préproduction : en-tête noindex" "identifiant de revue non fourni (E2E_HTTP_USER) : seule la protection 401 est vérifiée"; fi

suites=("{\"id\":\"http\",\"label\":\"Contrôles HTTP et serveur\",\"kind\":\"shell\",\"file\":\"$CHK\",\"planned\":true}")
REF=""
if [ "$BROWSER" = 1 ]; then
  # référence PDF : extraite à nouveau (indépendante) si le PDF privé est présent
  if [ -f "$ROOT/inputs/heliostores/selt-pricing/7254168cenniki_SOP_wyrob_gotowy_FR.pdf" ]; then
    bash "$ROOT/scripts/recette/audit-tarifs/run.sh" --out "$OUT/reference" --levels "" >"$OUT/reference.log" 2>&1 || true
    [ -f "$OUT/reference/reference.json" ] && REF="$OUT/reference/reference.json"
  fi
  log "parcours navigateur en lecture seule ($URL)"
  E2E_BASE_URL="$URL" RECETTE_MODE=production RECETTE_REFERENCE="$REF" RECETTE_REPORT_DIR="$OUT" \
    pnpm -s exec playwright test -c playwright.recette.config.ts tests/recette/controle-public.spec.ts tests/recette/prix-pdf.spec.ts >"$OUT/playwright.log" 2>&1 || true
  suites+=("{\"id\":\"browser\",\"label\":\"Parcours publics et prix (lecture seule)\",\"kind\":\"playwright\",\"file\":\"$OUT/playwright-recette.json\",\"planned\":true}")
else suites+=("{\"id\":\"browser\",\"label\":\"Parcours publics et prix (lecture seule)\",\"kind\":\"playwright\",\"file\":\"\",\"planned\":false,\"reason\":\"--no-browser\"}"); fi
printf '{"id":"controle-production-%s","date":"%s","environment":"production (lecture seule)","baseUrl":"%s","commit":"%s","dirty":false,"reference":"%s","suites":[%s]}\n' \
  "$TS" "$(date -Iseconds)" "$URL" "${RUNNING##*|}" "${REF:+PDF sha256 $(python3 -I -c 'import json,sys;print(json.load(open(sys.argv[1]))["document"]["sha256Checked"])' "$REF")}" "$(IFS=,; echo "${suites[*]}")" >"$OUT/campaign.json"
NODE_OPTIONS="--require $ROOT/scripts/lib/server-only-shim.cjs" pnpm -s exec tsx scripts/recette/report.ts "$OUT"; rc=$?
log "rapport : $OUT/rapport.md — résumé : $OUT/resume-public.md"
exit $rc
