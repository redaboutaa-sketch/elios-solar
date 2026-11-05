#!/usr/bin/env bash
# Alimente la base de PRODUCTION (vide) à partir d'une sauvegarde de la préproduction, puis purge les données de test.
#   scripts/prepare-production-db.sh <db_preprod.dump> <media_preprod.tar.gz>
# Préconditions : pile docker/compose.production.yml créée, conteneur heliostores-prod-postgres démarré, base vide.
# - refuse une base de production non vide (aucun écrasement) ;
# - restaure le dump, applique scripts/production-purge.sql, affiche les comptages ;
# - copie les médias du catalogue dans le volume heliostores_prod_uploads, sans les visuels de devis (dossier quotes/).
# Les identifiants PostgreSQL sont lus dans .env.heliostores-prod, jamais affichés.
set -euo pipefail
DUMP="${1:?dump de préproduction requis}"; MEDIA="${2:?archive des médias requise}"
ENV_FILE="${ENV_FILE:-.env.heliostores-prod}"; PG="${PG_CONTAINER:-heliostores-prod-postgres}"; VOL="${MEDIA_VOLUME:-heliostores_prod_uploads}"
val() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
U="$(val POSTGRES_USER)"; D="$(val POSTGRES_DB)"
[ -n "$U" ] && [ -n "$D" ] || { echo "POSTGRES_USER / POSTGRES_DB absents de $ENV_FILE" >&2; exit 1; }
case "$D" in heliostores*) ;; *) echo "base cible inattendue : $D" >&2; exit 1;; esac
psqlp() { docker exec -i "$PG" psql -v ON_ERROR_STOP=1 -U "$U" -d "$D" "$@"; }
TABLES=$(psqlp -Atc "select count(*) from information_schema.tables where table_schema='public'")
[ "$TABLES" = "0" ] || { echo "base de production non vide ($TABLES tables) : arrêt, rien n'est écrasé" >&2; exit 1; }
echo "1) Restauration de la copie de préproduction dans $D"
docker exec -i "$PG" pg_restore --no-owner --role="$U" -U "$U" -d "$D" < "$DUMP"
echo "2) Purge des données de test"
psqlp < scripts/production-purge.sql >/dev/null
echo "3) Contrôle"
psqlp -Atc "select 'utilisateurs='||(select count(*) from \"user\")||' devis='||(select count(*) from \"Quote\")||' commandes='||(select count(*) from \"Order\")||' paiements='||(select count(*) from \"Payment\")||' e-mails='||(select count(*) from \"EmailOutbox\")||' conversations='||(select count(*) from \"Conversation\")||' familles='||(select count(*) from \"ProductFamily\")||' médias='||(select count(*) from \"Media\")||' grilles en vigueur='||(select count(*) from \"SupplierPriceList\" where status='ACTIVE' and scope='GRID' and nature='SALE')"
echo "4) Médias du catalogue → volume $VOL (sans quotes/)"
docker run --rm -v "$VOL":/u -v "$(cd "$(dirname "$MEDIA")" && pwd)":/b:ro "${TAR_IMAGE:-alpine:3.20}" sh -c "tar -xzf /b/$(basename "$MEDIA") -C /u --exclude='./quotes' --exclude='quotes' && rm -rf /u/quotes && chown -R 999:999 /u 2>/dev/null; find /u -type f | wc -l"
echo "Terminé. Étapes suivantes : migrations (service migrate), seed catalogue, administrateur (docs/production-runbook.md)."
