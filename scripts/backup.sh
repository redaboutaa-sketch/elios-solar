#!/usr/bin/env bash
# Sauvegarde base + médias. Préconditions : DATABASE_URL (ou conteneur elios-solar-postgres), dossier uploads.
# Usage : scripts/backup.sh [dossier_destination]   (défaut : ./backups)
set -euo pipefail
DEST="${1:-./backups}"; mkdir -p "$DEST"
STAMP="$(date +%Y%m%d_%H%M%S)"
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --no-owner --format=custom "$DATABASE_URL" > "$DEST/db_$STAMP.dump"
else
  docker exec "${PG_CONTAINER:-elios-solar-postgres}" pg_dump -U "${POSTGRES_USER:-elios}" --no-owner --format=custom "${POSTGRES_DB:-elios_solar}" > "$DEST/db_$STAMP.dump"
fi
MEDIA="${MEDIA_STORAGE_DIR:-./uploads}"
if [ -d "$MEDIA" ]; then tar -czf "$DEST/media_$STAMP.tar.gz" -C "$(dirname "$MEDIA")" "$(basename "$MEDIA")"; fi
sha256sum "$DEST"/*_"$STAMP".* > "$DEST/checksums_$STAMP.txt"
echo "Sauvegarde : $DEST (db_$STAMP.dump$( [ -d "$MEDIA" ] && echo ", media_$STAMP.tar.gz"))"
