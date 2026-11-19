---
name: recette-site
description: Campagne de recette fonctionnelle complète de HELIOSTORES (public, configurateurs, projets anciens, compte et devis, chat, administration, ordinateur et mobile) sur un environnement ISOLÉ, avec rapport Réussi / Échoué / Non testé / Bloqué / Sans objet. À utiliser pour valider une version avant déploiement ou rechercher des défauts fonctionnels.
argument-hint: "[--source prod|seed] [--only unit,integration,e2e,recette,audit] [--keep]"
disable-model-invocation: true
allowed-tools: Bash(scripts/recette/campaign.sh *) Bash(scripts/recette/env.sh *) Bash(git status *) Bash(git log *)
---

# /recette-site — recette fonctionnelle HELIOSTORES

Arguments reçus : `$ARGUMENTS` (vides = campagne complète sur une copie anonymisée de la production).

## Avant de commencer

1. Lire `AGENTS.md`, `docs/STATE.md`, `docs/DECISIONS.md`, `docs/production-runbook.md` (§ 1, 5, 6) et la dernière
   campagne (`docs/recette/README.md`, `docs/test-report.md`).
2. Vérifier les outils : `node -v` (22), `pnpm -v`, `pnpm exec playwright --version`, `docker ps` (conteneur
   `elios-solar-dev-postgres` en marche, port 127.0.0.1:5433), port 3410 libre (`ss -ltn | grep 3410`).
3. Arbre de travail : noter `git status --short` ; une campagne sur des modifications non commitées est signalée
   comme telle dans le rapport (`dirty`).
4. Matrice de couverture : `docs/recette/matrice-couverture.md` (fonctionnalité → produits → scénario → attendu →
   test existant → couverture manquante). La mettre à jour si une fonctionnalité apparaît ou disparaît.

## Environnement (choix explicite)

| Choix | Commande | Données |
|---|---|---|
| Copie isolée de la production (défaut) | `scripts/recette/campaign.sh` | base `recette_<id>` dans PostgreSQL de dev, copiée en lecture seule puis **anonymisée** (`scripts/recette/anonymize.sql`), médias copiés |
| Jeu d'essai neuf | `scripts/recette/campaign.sh --source seed` | migrations + `prisma/seed.ts` |
| Production | **interdit ici** : utiliser `/controle-production` (lecture seule) | — |

Garanties de l'environnement isolé (`scripts/recette/env.sh`) : application sur `localhost:3410` (boucle locale) seulement (aucun port
public), `SITE_INDEXABLE=false`, e-mails capturés en local (`MAIL_PROVIDER=log`, file `EmailOutbox` de la copie),
paiement simulé interne (`PAYMENT_PROVIDER=demo`, aucun prestataire externe), secrets aléatoires propres à la campagne
(fichier 600 dans `private/`, jamais affichés), administrateur de test aléatoire `e2e-admin@test.invalid` (comptes réels
de la copie neutralisés : mots de passe et sessions supprimés).

## Lancer

```bash
scripts/recette/campaign.sh                      # tout : unitaires, intégration, tests/e2e, tests/recette, audit tarifs
scripts/recette/campaign.sh --only e2e,recette   # sous-ensemble
scripts/recette/campaign.sh --keep               # laisse l'environnement démarré pour l'exploration
```

- Verrou exclusif (`/tmp/heliostores-recette.lock`) : une seule campagne à la fois ; une seconde s'arrête aussitôt.
- Aucune relance automatique (`retries: 0`, `failOnFlakyTests`). Une tentative de diagnostic (relancer un test seul)
  reste distincte du résultat de la campagne : ne jamais remplacer le rapport de campagne par un rejeu partiel.
- Durée indicative : 25 à 40 minutes.

## Explorer avec le navigateur piloté (complément)

Avec `--keep`, l'application reste sur `http://localhost:3410`. Utiliser le navigateur piloté par Claude pour explorer
un défaut ou un parcours non couvert (cookies refusés puis acceptés, WebGL indisponible, réponses dans le désordre…),
puis **transcrire** tout défaut reproduit en test Playwright (`tests/e2e/` ou `tests/recette/`) avant de le corriger.
Une capture ne remplace jamais une assertion ; une console sans erreur ne prouve pas qu'un parcours fonctionne.

## Rapport

`private/recette/runs/<id>/reports/` :
- `rapport.md` (**privé** : erreurs complètes, traces, montants éventuels), `resume-public.md` (publiable),
  `resultats.json`, rapports bruts Playwright/Vitest, traces et captures des échecs (`e2e-traces/`,
  `playwright-recette-traces/`), captures 390 / 768 / 1440 px (`captures/`).
- En-tête : date, environnement, commit, versions tarifaires actives, empreinte de la référence PDF.
- Statuts : **Réussi** ; **Échoué** ; **Non testé** (ignoré sans justification « sans objet », ou suite non demandée) ;
  **Bloqué** (suite prévue mais non exécutable, rapport absent) ; **Sans objet** (motif commençant par « sans objet : »).
  Un test ignoré n'est jamais compté comme réussi.

## Pour chaque échec

1. Reproduire seul (même environnement) ; 2. identifier la cause ; 3. ajouter un test indépendant pertinent (valeur
attendue jamais recopiée de la valeur obtenue) ; 4. corriger dans le périmètre existant (design, arborescence, noms
commerciaux et politique tarifaire inchangés) ; 5. rejouer les contrôles concernés ; 6. campagne finale complète.
Ne jamais désactiver un test qui révèle un vrai défaut. Un défaut d'environnement (média absent, service externe) est
documenté comme tel, avec sa preuve.

## Nettoyage et erreurs

- Fin normale ou erreur : `trap` → `scripts/recette/env.sh down` (sauf `--keep`) : arrêt du seul PID consigné (vérifié :
  dossier du dépôt et port 3410), suppression des seules bases `recette_<id>` / `recette_it_<id>` créées, des médias
  copiés et des secrets de la campagne. Les rapports restent dans `private/recette/runs/<id>/reports/`.
- Jamais de `pkill` générique, jamais de suppression globale de volumes, aucun autre site du VPS touché.
- Environnement resté démarré : `scripts/recette/env.sh status` puis `scripts/recette/env.sh down`.

## Limites

Voir `docs/recette/README.md` § Limites (paiement réel Stripe, envoi SMTP réel, LLM du chat, WebGL matériel…).
