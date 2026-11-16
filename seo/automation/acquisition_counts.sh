#!/usr/bin/env bash
# Comptes agrégés des demandes (devis hors démonstration, contacts) par fenêtre de 28 jours, source et page d'entrée.
# Lecture seule (transaction read-only) sur la base de production HELIOSTORES ; aucune donnée personnelle extraite.
# Sortie : $STATE_DIR/acquisition/AAAA-MM-JJ.txt (lu par le passage hebdomadaire).
set -euo pipefail
STATE_DIR="${STATE_DIRECTORY:-/var/lib/heliostores-seo}"
mkdir -p "$STATE_DIR/acquisition"
OUT="$STATE_DIR/acquisition/$(date +%F).txt"
SQL_SRC="coalesce(attribution->'params'->>'utm_source', attribution->>'referrerHost', 'direct ou non renseigné')"
{
  echo "# Demandes HELIOSTORES — comptes agrégés au $(date '+%F %H:%M %Z') ; fenêtres glissantes de 28 jours"
  echo "# colonnes : fenêtre | source (utm_source, sinon référent, sinon direct) | page d'entrée | nombre"
  echo "## Devis (hors données de démonstration)"
  docker exec -i heliostores-prod-postgres psql -U heliostores -d heliostores -At -F ' | ' -v ON_ERROR_STOP=1 <<SQL
SET default_transaction_read_only = on;
SELECT CASE WHEN "createdAt" >= now() - interval '28 days' THEN 'J-28..J0' ELSE 'J-56..J-29' END,
       $SQL_SRC, coalesce(attribution->>'landingPath', 'non renseignée'), count(*)
FROM "Quote" WHERE "createdAt" >= now() - interval '56 days' AND NOT "containsDemoData"
GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC;
SQL
  echo "## Demandes de contact / rappel"
  docker exec -i heliostores-prod-postgres psql -U heliostores -d heliostores -At -F ' | ' -v ON_ERROR_STOP=1 <<SQL
SET default_transaction_read_only = on;
SELECT CASE WHEN "createdAt" >= now() - interval '28 days' THEN 'J-28..J0' ELSE 'J-56..J-29' END,
       $SQL_SRC, coalesce(attribution->>'landingPath', 'non renseignée'), count(*)
FROM "ContactRequest" WHERE "createdAt" >= now() - interval '56 days'
GROUP BY 1, 2, 3 ORDER BY 1, 4 DESC;
SQL
} | grep -v '^SET$' > "$OUT"
chmod 600 "$OUT"
find "$STATE_DIR/acquisition" -name '*.txt' -mtime +400 -delete
echo "comptes d'acquisition écrits : $OUT"
