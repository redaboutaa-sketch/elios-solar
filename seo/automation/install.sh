#!/usr/bin/env bash
# Installe (ou met à jour) l'automatisation SEO HELIOSTORES depuis ce dossier versionné.
#   sudo bash seo/automation/install.sh daily    # contrôle quotidien seulement
#   sudo bash seo/automation/install.sh all      # contrôle quotidien + passage hebdomadaire (runner claude requis)
set -euo pipefail
WHAT="${1:-daily}"
SRC="$(cd "$(dirname "$0")" && pwd)"
LIB=/usr/local/lib/heliostores-seo
UNITS=/etc/systemd/system

# doublons : aucune autre planification SEO HELIOSTORES (cron ou unité d'un autre nom)
if grep -rqsE 'daily_check\.py|weekly_run\.sh|heliostores-seo' /etc/cron.d /etc/crontab /var/spool/cron 2>/dev/null; then
  echo "DOUBLON : une planification cron mentionne déjà l'automatisation SEO ; supprimez-la d'abord." >&2; exit 1
fi
others=$(systemctl list-unit-files --no-legend 'heliostores-seo*' 2>/dev/null | awk '{print $1}' | grep -vE '^heliostores-seo-(daily|weekly)\.(service|timer)$' || true)
[ -z "$others" ] || { echo "DOUBLON : unités inattendues : $others" >&2; exit 1; }

install -d -m 755 "$LIB"
install -m 755 "$SRC/daily_check.py" "$SRC/weekly_run.sh" "$SRC/acquisition_counts.sh" "$SRC/gsc_index_check.py" "$LIB/"
install -m 644 "$SRC/weekly-prompt.md" "$LIB/"
install -m 644 "$SRC"/systemd/heliostores-seo-*.service "$SRC"/systemd/heliostores-seo-*.timer "$UNITS/"
systemctl daemon-reload
systemctl enable --now heliostores-seo-daily.timer
if [ "$WHAT" = all ]; then
  command -v /root/.local/bin/claude >/dev/null || { echo "PRÉREQUIS MANQUANT : /root/.local/bin/claude ; passage hebdomadaire non activé" >&2; exit 2; }
  systemctl enable --now heliostores-seo-weekly.timer
else
  systemctl disable --now heliostores-seo-weekly.timer 2>/dev/null || true
fi
systemctl list-timers --all --no-pager 'heliostores-seo*'
