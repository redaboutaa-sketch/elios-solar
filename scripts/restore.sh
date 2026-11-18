#!/usr/bin/env bash
# Restauration vérifiée dans une base ISOLÉE puis bascule explicite. Ne supprime jamais de volume.
# Usage : scripts/restore.sh <db_dump> [media.tar.gz]
#   MEDIA_RESTORE_VOLUME : volume Docker cible des médias (ex. elios_solar_uploads) ; sinon extraction dans MEDIA_RESTORE_DIR
#   RESTORE_TARGET_URL : URL de la base cible (défaut : base de vérification temporaire elios_solar_restore_check)
set -euo pipefail
DUMP="${1:?dump requis}"; MEDIA_ARCHIVE="${2:-}"
ADMIN_URL="${RESTORE_ADMIN_URL:-${DATABASE_URL:-}}"
[ -n "$ADMIN_URL" ] || { echo "DATABASE_URL ou RESTORE_ADMIN_URL requis"; exit 1; }
CHECK_DB="elios_solar_restore_check"
BASE="${ADMIN_URL%/*}"
echo "1) Restauration de vérification dans $CHECK_DB"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $CHECK_DB;" -c "CREATE DATABASE $CHECK_DB;"
pg_restore --no-owner --dbname="$BASE/$CHECK_DB" "$DUMP"
COUNT=$(psql "$BASE/$CHECK_DB" -tAc 'SELECT count(*) FROM "Order";')
MIG=$(psql "$BASE/$CHECK_DB" -tAc 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;')
echo "   OK : $COUNT commandes, $MIG migrations appliquées dans la sauvegarde"
if [ -n "${RESTORE_TARGET_URL:-}" ]; then
  echo "2) Restauration dans la cible $RESTORE_TARGET_URL (les objets existants sont remplacés)"
  pg_restore --no-owner --clean --if-exists --dbname="$RESTORE_TARGET_URL" "$DUMP"
  echo "   Appliquez ensuite les migrations plus récentes : pnpm db:deploy"
else
  echo "2) Aucune cible (RESTORE_TARGET_URL absent) : vérification seulement."
fi
if [ -n "$MEDIA_ARCHIVE" ]; then
  if [ -n "${MEDIA_RESTORE_VOLUME:-}" ]; then
    # restauration dans un volume Docker (nommé explicitement) : ajoute ou remplace les fichiers, n'en supprime aucun
    docker run --rm -v "$MEDIA_RESTORE_VOLUME":/u -v "$(cd "$(dirname "$MEDIA_ARCHIVE")" && pwd)":/b:ro "${TAR_IMAGE:-alpine:3.20}" tar -xzf "/b/$(basename "$MEDIA_ARCHIVE")" -C /u
    echo "   Médias restaurés dans le volume $MEDIA_RESTORE_VOLUME ($(tar -tzf "$MEDIA_ARCHIVE" | grep -vc '/$') fichier(s))"
  else
    DEST="${MEDIA_RESTORE_DIR:-./uploads-restore}"; mkdir -p "$DEST"; tar -xzf "$MEDIA_ARCHIVE" -C "$DEST"; echo "   Médias extraits dans $DEST (à déplacer vers MEDIA_STORAGE_DIR, ou utiliser MEDIA_RESTORE_VOLUME)"
  fi
fi
psql "$ADMIN_URL" -c "DROP DATABASE IF EXISTS $CHECK_DB;" >/dev/null
