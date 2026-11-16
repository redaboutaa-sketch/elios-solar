#!/usr/bin/env bash
# Désinstalle l'automatisation SEO HELIOSTORES (l'état /var/lib/heliostores-seo* est conservé sauf --purge).
set -euo pipefail
systemctl disable --now heliostores-seo-daily.timer heliostores-seo-weekly.timer 2>/dev/null || true
rm -f /etc/systemd/system/heliostores-seo-{daily,weekly}.{service,timer}
systemctl daemon-reload
rm -rf /usr/local/lib/heliostores-seo
if [ "${1:-}" = "--purge" ]; then rm -rf /var/lib/heliostores-seo /var/lib/private/heliostores-seo-daily /var/lib/heliostores-seo-daily; fi
echo "automatisation SEO désinstallée"
