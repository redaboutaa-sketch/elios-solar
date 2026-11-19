# Recette HELIOSTORES : trois skills Claude Code

> Document publiable. Les rapports détaillés (montants, informations fournisseur, erreurs complètes) restent dans
> `private/recette/` (hors Git, droits 700).

| Skill | Rôle | Commande sous-jacente | Environnement |
|---|---|---|---|
| `/recette-site` | campagne complète : unitaires, intégration, parcours `tests/e2e` (desktop + mobile), contrôles publics et visuels, audit des tarifs | `scripts/recette/campaign.sh` | copie **isolée** anonymisée de la production (ou jeu d'essai) sur `localhost:3410` (boucle locale) |
| `/audit-tarifs` | référence indépendante extraite du PDF ; A PDF → base, B → moteur, C → navigateur → devis | `scripts/recette/audit-tarifs/run.sh` | PDF privé + copie isolée (A peut aussi lire la production en lecture seule) |
| `/controle-production` | contrôle après déploiement, public et non destructif | `scripts/recette/controle-production.sh --expect-commit <sha>` | `https://heliostores.com` en lecture seule |

Définitions : `.claude/skills/<nom>/SKILL.md`. Dans Claude Code, taper `/recette-site`, `/audit-tarifs` ou
`/controle-production` (arguments facultatifs). Sans Claude Code, les scripts se lancent directement.

## Statuts des rapports

Réussi ; Échoué ; **Non testé** (test ignoré sans justification « sans objet », ou suite non demandée) ; **Bloqué**
(suite prévue mais non exécutable) ; **Sans objet** (motif « sans objet : … » obligatoire). Un test ignoré n'est
jamais compté comme réussi. Une campagne avec au moins un échec ou un blocage est en échec.

## Garde-fous

- Une seule campagne à la fois (verrou `/tmp/heliostores-recette.lock`) ; aucune relance automatique.
- Nettoyage limité aux ressources consignées : base `recette_<id>` / `recette_it_<id>`, médias copiés, secrets de la
  campagne, PID du serveur de recette (vérifié par dossier et port) ; jamais de `pkill` générique.
- Copie de production anonymisée avant tout démarrage ; comptes réels neutralisés ; administrateur de test aléatoire.
- Production : lecture seule, aucune IP simulée, aucune écriture ; préproduction : protection 401 vérifiée.
- Le PDF fournisseur et la référence extraite ne sont jamais dans Git.

## Portée de la CI (sans le PDF)

La CI (`.github/workflows/ci.yml`) exécute les tests unitaires (dont grilles **fictives** de même structure et
cohérence du manifeste d'audit, `tests/unit/recette-manifest.test.ts`), d'intégration et la suite `tests/e2e` (dont
le spec 27). Elle ne vérifie **ni les montants réels ni la conformité au PDF** : l'audit intégral se fait sur le VPS.

## Limites connues (non testé ou sans objet)

- Paiement réel (Stripe non raccordé, paiement désactivé en production) : seul le simulateur interne est testé.
- Envoi SMTP réel : sans objet tant qu'aucun SMTP n'est fourni (file d'e-mails et fournisseur réel affichés seulement).
- LLM du chat : non raccordé ; seule l'aide guidée est testée.
- WebGL matériel : rendu 3D vérifié par attributs et repli 2D, pas par comparaison d'image.
- Suppléments textuels du PDF (options, moteurs, LED, poteaux) : relus à l'import, non réextraits par l'audit.
- Préproduction : en-tête noindex vérifié seulement si l'identifiant de revue est fourni à l'exécution.
- Mot de passe oublié de bout en bout (lien reçu par e-mail) : non testé.
