#!/usr/bin/env bash
# Passage SEO/GEO hebdomadaire : agent `claude -p` (Claude Code CLI) dans un worktree dédié, lot d'au plus trois
# améliorations, PR en brouillon. Jamais de fusion ni de déploiement.
#   weekly_run.sh            passage réel (systemd : heliostores-seo-weekly.service)
#   weekly_run.sh --dry-run  essai en lecture seule : aucun fichier écrit, aucun commit, budget réduit
set -euo pipefail
export HOME="${HOME:-/root}"
export PATH="/root/.local/bin:/usr/local/bin:/usr/bin:/bin"
REPO=/opt/pergola
WT=/root/worktrees/pergola-seo-auto
LIB=/usr/local/lib/heliostores-seo
STATE_DIR="${STATE_DIRECTORY:-/var/lib/heliostores-seo}"
BASE=feat/heliostores
GH_REPO=redaboutaa-sketch/elios-solar
BUDGET="${SEO_MAX_BUDGET_USD:-8}"       # plafond de dépense par passage (option --max-budget-usd)
MODEL="${SEO_MODEL:-sonnet}"            # alias documenté par `claude --help`
MAX_SECONDS="${SEO_MAX_SECONDS:-5400}"  # délai maximal de l'agent (le service a aussi TimeoutStartSec)
DRY=0; [ "${1:-}" = "--dry-run" ] && DRY=1 && BUDGET="${SEO_DRY_BUDGET_USD:-1.5}"
mkdir -p "$STATE_DIR/weekly"
STAMP=$(date +%F-%H%M)

exec 9>/run/heliostores-seo-weekly.lock
flock -n 9 || { echo "passage déjà en cours : abandon (verrou)"; exit 0; }

command -v claude >/dev/null || { echo "PRÉREQUIS MANQUANT : CLI claude introuvable"; exit 2; }
gh auth status >/dev/null 2>&1 || { echo "PRÉREQUIS MANQUANT : gh non authentifié"; exit 2; }

# entrées de l'agent : copies réelles des 7 derniers contrôles quotidiens et des incidents ouverts
DAILY_DIR="${DAILY_STATE:-/var/lib/heliostores-seo-daily}"
rm -rf "$STATE_DIR/entree" && mkdir -p "$STATE_DIR/entree/daily"
ls -1 "$DAILY_DIR/daily/"*.json 2>/dev/null | tail -7 | xargs -r cp -t "$STATE_DIR/entree/daily/"
cp "$DAILY_DIR/incidents.json" "$STATE_DIR/entree/" 2>/dev/null || echo "{}" > "$STATE_DIR/entree/incidents.json"
# données de mesure (lecture seule, agrégées)
bash "$LIB/acquisition_counts.sh" || echo "comptes d'acquisition indisponibles (passage poursuivi)"

git -C "$REPO" fetch -q origin --prune
OPEN=$(gh pr list -R "$GH_REPO" --state open --json headRefName --jq '[.[] | select(.headRefName | startswith("seo/"))][0].headRefName // ""')
if [ -n "$OPEN" ]; then MODE=reprise; BRANCH="$OPEN"; START="origin/$OPEN"; else MODE=nouveau; BRANCH="seo/auto-$(date +%F)"; START="origin/$BASE"; fi
DOM=$(date +%-d); MONTHLY=0; [ "$DOM" -le 7 ] && MONTHLY=1   # premier lundi du mois
echo "$(date '+%F %T') passage hebdomadaire : mode=$MODE branche=$BRANCH mensuel=$MONTHLY essai=$DRY budget=${BUDGET}USD modèle=$MODEL"

# worktree dédié, recréé à chaque passage (détaché : n'entre pas en conflit avec une branche extraite ailleurs)
if git -C "$REPO" worktree list --porcelain | grep -qx "worktree $WT"; then git -C "$REPO" worktree remove --force "$WT"; fi
rm -rf "$WT"
git -C "$REPO" worktree add -q --detach "$WT" "$START"
cd "$WT"
ln -sf "$REPO/.env" .env                 # base de développement locale (fichier ignoré par Git)
pnpm install --frozen-lockfile --offline >/dev/null
pnpm -s db:generate >/dev/null
npx next typegen >/dev/null

PROMPT=$(sed -e "s|{{STATE_DIR}}|$STATE_DIR|g" -e "s|{{MODE}}|$MODE|g" -e "s|{{BRANCH}}|$BRANCH|g" -e "s|{{MONTHLY}}|$MONTHLY|g" "$LIB/weekly-prompt.md")
PROMPT="$PROMPT

---
Paramètres : date=$(date +%F) ; mode=$MODE ; branche=$BRANCH ; revue mensuelle=$MONTHLY ; état=$STATE_DIR"

READ_TOOLS=(Read Glob Grep WebFetch WebSearch "Bash(git status*)" "Bash(git log*)" "Bash(git diff*)" "Bash(git show*)" "Bash(gh pr list*)" "Bash(gh pr view*)" "Bash(ls*)" "Bash(cat*)" "Bash(grep*)" "Bash(head*)" "Bash(tail*)" "Bash(wc*)" "Bash(curl -s*)" "Bash(python3 *)" "Bash(node *)")
WRITE_TOOLS=(Edit Write "Bash(git add*)" "Bash(git commit*)" "Bash(git push origin HEAD:refs/heads/seo/*)" "Bash(gh pr create*)" "Bash(gh pr comment*)" "Bash(gh pr edit*)" "Bash(pnpm -s typecheck*)" "Bash(pnpm -s lint*)" "Bash(pnpm -s test:unit*)" "Bash(pnpm -s build*)" "Bash(mkdir -p seo*)")
DENY=("Bash(git push --force*)" "Bash(git push -f*)" "Bash(gh pr merge*)" "Bash(docker*)" "Bash(*deploy-production*)" "Bash(git reset --hard*)" "Bash(rm -rf*)" "Bash(systemctl*)" "Bash(*/opt/pergola*)")
if [ "$DRY" = 1 ]; then
  ALLOWED=("${READ_TOOLS[@]}")
  PROMPT="$PROMPT

MODE ESSAI : lecture seule. N'écris aucun fichier, ne commite rien, ne crée aucune PR. Lis l'état (section 1), puis
réponds en quinze lignes au plus : PR ouverte détectée, incidents quotidiens lus, lot que tu choisirais et pourquoi."
else
  ALLOWED=("${READ_TOOLS[@]}" "${WRITE_TOOLS[@]}")
fi

find "$STATE_DIR/weekly" -name "*.json" -mtime +370 -delete
OUT="$STATE_DIR/weekly/$STAMP$([ "$DRY" = 1 ] && echo -essai).json"
set +e
timeout "$MAX_SECONDS" claude -p "$PROMPT" --model "$MODEL" --permission-mode dontAsk \
  --allowedTools "${ALLOWED[@]}" --disallowedTools "${DENY[@]}" \
  --add-dir "$STATE_DIR" --max-budget-usd "$BUDGET" --no-session-persistence --output-format json > "$OUT"
RC=$?
set -e
python3 -I - "$OUT" "$RC" <<'PY'
import json, sys
path, rc = sys.argv[1], sys.argv[2]
try:
    d = json.load(open(path))
    print(f"agent : code {rc}, {d.get('subtype')}, {d.get('num_turns')} tours, coût {d.get('total_cost_usd', 0):.2f} USD, refus d'outils {len(d.get('permission_denials') or [])}")
    print((d.get("result") or "")[:3000])
except Exception as e:
    print(f"agent : code {rc}, sortie illisible ({e})")
PY
exit "$RC"
