#!/usr/bin/env bash
# Sauvegarde base + médias. Préconditions : DATABASE_URL (ou conteneur elios-solar-postgres), dossier uploads.
# Usage : scripts/backup.sh [dossier_destination]   (défaut : ./backups)
#   préproduction Docker : MEDIA_VOLUME=elios_solar_uploads scripts/backup.sh backups/preprod
set -euo pipefail
DEST="${1:-./backups}"; mkdir -p "$DEST"
STAMP="$(date +%Y%m%d_%H%M%S)"
if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --no-owner --format=custom "$DATABASE_URL" > "$DEST/db_$STAMP.dump"
else
  docker exec "${PG_CONTAINER:-elios-solar-postgres}" pg_dump -U "${POSTGRES_USER:-elios}" --no-owner --format=custom "${POSTGRES_DB:-elios_solar}" > "$DEST/db_$STAMP.dump"
fi
# Médias : volume Docker de la préproduction (MEDIA_VOLUME, ex. elios_solar_uploads, lu en lecture seule)
# ou dossier local (MEDIA_STORAGE_DIR, défaut ./uploads). L'archive contient les fichiers à la racine.
MEDIA="${MEDIA_STORAGE_DIR:-./uploads}"; MEDIA_DONE=""
if [ -n "${MEDIA_VOLUME:-}" ]; then
  docker run --rm -v "$MEDIA_VOLUME":/u:ro -v "$(cd "$DEST" && pwd)":/b "${TAR_IMAGE:-alpine:3.20}" tar -czf "/b/media_$STAMP.tar.gz" -C /u .
  MEDIA_DONE=1
elif [ -d "$MEDIA" ]; then
  tar -czf "$DEST/media_$STAMP.tar.gz" -C "$MEDIA" .
  MEDIA_DONE=1
fi
(cd "$DEST" && sha256sum ./*_"$STAMP".* > "checksums_$STAMP.txt")
[ -n "$MEDIA_DONE" ] && echo "Médias : $(tar -tzf "$DEST/media_$STAMP.tar.gz" | grep -vc '/$') fichier(s) archivé(s)"
echo "Sauvegarde : $DEST (db_$STAMP.dump${MEDIA_DONE:+, media_$STAMP.tar.gz})"
