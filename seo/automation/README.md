# Automatisation SEO / GEO (serveur de production)

Deux tâches `systemd` (le serveur utilise déjà des minuteries systemd ; fuseau `Europe/Paris` explicite, donc suivi des
changements d'heure ; `Persistent=true` rattrape une échéance manquée après redémarrage).

| Tâche | Échéance | Ce qu'elle fait | LLM |
|---|---|---|---|
| `heliostores-seo-daily.timer` | chaque jour 07:00 (Paris) | `daily_check.py` : disponibilité, http→https, www→domaine, robots.txt, sitemap, 404, 19 URL commerciales (statut, canonique, noindex, titre, H1, JSON-LD). ~25 requêtes à 1 s d'intervalle. Aucune écriture sur le site. | non |
| `heliostores-seo-weekly.timer` | chaque lundi 08:30 (Paris) | `weekly_run.sh` : comptes agrégés des demandes (lecture seule), worktree dédié, agent `claude -p` avec `weekly-prompt.md`, lot ≤ 3 améliorations, PR en brouillon ; revue mensuelle le premier lundi du mois (≤ 2 guides/mois) | oui |

## Garde-fous

- Verrou : `flock` (`/run/heliostores-seo-weekly.lock`) ; systemd n'exécute jamais deux fois la même unité `oneshot`.
- Délais maximaux : 10 min (quotidien), 2 h (hebdomadaire, `TimeoutStartSec`) et 90 min pour l'agent (`timeout`).
- Coût : `--max-budget-usd` (8 USD par passage, 1,5 USD en essai ; variables `SEO_MAX_BUDGET_USD`,
  `SEO_DRY_BUDGET_USD`), modèle `--model sonnet` (`SEO_MODEL`). Options vérifiées par `claude --help` (v2.1.323) et essai.
- Permissions de l'agent : `--permission-mode dontAsk` + liste d'outils autorisés (lecture, édition, git add/commit,
  `git push origin HEAD:refs/heads/seo/*`, `gh pr create/comment/edit`, typecheck/lint/tests/build) ; refus explicites :
  fusion de PR, force push, Docker, déploiement, `systemctl`, `rm -rf`, `/opt/pergola`. Tout outil non listé est refusé
  (vérifié par essai : l'appel Bash non autorisé a été refusé).
- Une seule PR SEO ouverte à la fois : si une branche `seo/*` a une PR ouverte, le passage la reprend (mode `reprise`).
- Contrôle quotidien : utilisateur dynamique sans privilège (`DynamicUser`), système de fichiers en lecture seule.
- Incidents dédoublonnés (`incidents.json`) : « NOUVEL INCIDENT » une fois, puis « persistant », puis « RÉSOLU ».
  Aucune notification externe, aucun e-mail.
- Secrets : aucun dans le dépôt ; l'agent réutilise les accès existants de `root` (`gh`, Claude Code).

## État et journaux

- Journal système (7 jours, rotation par journald) : `journalctl -u heliostores-seo-daily` / `-u heliostores-seo-weekly`.
- Historique durable : `/var/lib/heliostores-seo-daily/daily/AAAA-MM-JJ.json` (90 jours), `incidents.json` ;
  `/var/lib/heliostores-seo/weekly/*.json` (sortie de l'agent, 1 an) ; `/var/lib/heliostores-seo/acquisition/*.txt`
  (comptes agrégés, 0600).

## Commandes

```bash
# installer / mettre à jour depuis ce dossier
bash seo/automation/install.sh daily          # quotidien seul
bash seo/automation/install.sh all            # quotidien + hebdomadaire
# échéances
systemctl list-timers --all 'heliostores-seo*'
# journaux
journalctl -u heliostores-seo-daily -n 50 --no-pager
journalctl -u heliostores-seo-weekly -n 200 --no-pager
cat /var/lib/heliostores-seo-daily/incidents.json
# lancer à la main
systemctl start heliostores-seo-daily.service
systemctl start heliostores-seo-weekly.service            # passage réel
bash /usr/local/lib/heliostores-seo/weekly_run.sh --dry-run   # essai en lecture seule
# suspendre / relancer
systemctl disable --now heliostores-seo-weekly.timer       # suspendre le passage hebdomadaire
systemctl enable --now heliostores-seo-weekly.timer        # relancer
systemctl disable --now heliostores-seo-daily.timer        # suspendre le contrôle quotidien
systemctl enable --now heliostores-seo-daily.timer
# désinstaller (état conservé ; --purge pour l'effacer)
bash seo/automation/uninstall.sh
```
