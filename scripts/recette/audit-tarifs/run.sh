#!/usr/bin/env bash
# /audit-tarifs : contrôle indépendant des tarifs au PDF fournisseur.
#   scripts/recette/audit-tarifs/run.sh [--out <dossier>] [--levels ABC] [--prod-a]
#   A : PDF → base (copie isolée en cours ; --prod-a : AUSSI la production, en lecture seule)
#   B : référence → moteur serveur (copie isolée en cours, jamais la production)
#   C : référence → navigateur → nouveau devis (environnement isolé en cours)
# Sorties PRIVÉES (montants) dans private/recette/… ; code de sortie ≠ 0 si un écart bloquant est trouvé.
source "$(dirname "$0")/../lib.sh"
OUT="" LEVELS="ABC" PROD_A=0
while [ $# -gt 0 ]; do case "$1" in --out) OUT="$2"; shift 2;; --levels) LEVELS="$2"; shift 2;; --prod-a) PROD_A=1; shift;; *) die "option inconnue : $1";; esac; done
OUT="${OUT:-$RECETTE_DIR/audit-tarifs/$(date +%Y%m%d_%H%M%S)}"; mkdir -p "$OUT"; chmod 700 "$OUT"
VENV="$RECETTE_DIR/.venv"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c "import pdfplumber" 2>/dev/null; then
  log "préparation de l'environnement Python (pdfplumber 0.11.10)"; python3 -m venv "$VENV" && "$VENV/bin/pip" install -q pdfplumber==0.11.10
fi
rc=0
log "référence indépendante extraite du PDF"
"$VENV/bin/python" -I "$ROOT/scripts/recette/audit-tarifs/reference.py" "$OUT" | tee "$OUT/reference.log" || rc=1
REF="$OUT/reference.json"
DB="$(state_get DB)"
if [[ "$LEVELS" == *A* ]]; then
  if [ -n "$DB" ]; then python3 -I "$ROOT/scripts/recette/audit-tarifs/compare_db.py" "$REF" "$OUT" --source recette --db "$DB" || rc=1; else log "niveau A (copie) : aucun environnement isolé — non testé"; fi
  [ "$PROD_A" = 1 ] && { python3 -I "$ROOT/scripts/recette/audit-tarifs/compare_db.py" "$REF" "$OUT" --source prod || rc=1; }
fi
if [[ "$LEVELS" == *B* ]]; then
  if [ -n "$DB" ]; then
    ( set -a; source "$(state_get RUN_DIR)/app.env"; set +a
      cd "$ROOT" && NODE_OPTIONS="--require $ROOT/scripts/lib/server-only-shim.cjs" pnpm -s exec tsx scripts/recette/audit-tarifs/engine-check.ts "$REF" "$OUT" ) || rc=1
  else log "niveau B : aucun environnement isolé — non testé"; fi
fi
if [[ "$LEVELS" == *C* ]]; then
  if [ -n "$DB" ]; then
    ( set -a; source "$(state_get RUN_DIR)/app.env"; set +a
      cd "$ROOT" && E2E_BASE_URL="$RECETTE_URL" RECETTE_MODE=isolated RECETTE_REFERENCE="$REF" RECETTE_REPORT_DIR="$OUT" \
        pnpm -s exec playwright test -c playwright.recette.config.ts tests/recette/prix-pdf.spec.ts ) || rc=1
  else log "niveau C : aucun environnement isolé — non testé"; fi
fi
log "sorties : $OUT"
exit $rc
