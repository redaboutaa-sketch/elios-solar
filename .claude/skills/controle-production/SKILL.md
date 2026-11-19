---
name: controle-production
description: Contrôle de HELIOSTORES en production après un déploiement — santé et commit exécuté, pages, médias, prix d'appel, configurations représentatives, cas HelioLux, protection de l'administration et des documents privés, préproduction protégée — en lecture seule, sans aucune écriture.
argument-hint: "[--expect-commit <sha>] [--no-browser]"
disable-model-invocation: true
allowed-tools: Bash(scripts/recette/controle-production.sh *) Bash(curl -s*)
---

# /controle-production — contrôle public non destructif

Arguments : `$ARGUMENTS`. Passer toujours `--expect-commit <sha>` après un déploiement (sha court du tag déployé).

## Règles

- Lecture seule : aucune commande, aucune demande de devis, aucun message de chat ou de contact, aucun paiement, aucune
  connexion à un compte. La base de production n'est lue qu'en transaction `read only` (identifiant d'un devis existant
  pour vérifier que ses documents restent privés).
- Aucune IP simulée, aucun contournement des limites ; un échec dû à une limite est signalé, pas contourné.
- Aucun identifiant affiché : les identifiants de revue de la préproduction ne sont utilisés que s'ils sont fournis
  dans l'environnement (`E2E_HTTP_USER`, `E2E_HTTP_PASSWORD`) ; les fichiers de mots de passe d'amorçage ne sont jamais
  lus ni cités.
- Les parcours qui écrivent (devis, compte, chat, administration) se vérifient sur l'environnement isolé
  (`/recette-site`), jamais ici.
- Un succès local ne suffit pas à annoncer la production corrigée : seul ce contrôle, exécuté sur le domaine public,
  le permet. S'il est impossible (domaine injoignable, référence absente…), le résultat est « non vérifié » avec la cause.

## Lancer

```bash
scripts/recette/controle-production.sh --expect-commit "$(git rev-parse --short=12 HEAD)"
```

## Contenu

1. HTTP et serveur (`controles-http.tsv`) : `/api/health` (application, base, commit exécuté = attendu), accueil 200
   sans `X-Robots-Tag`, `www` → 301, robots et sitemap, `/compte` en noindex, `/admin` → connexion, PDF et visuel d'un
   devis existant inaccessibles sans session, `PAYMENT_PROVIDER=disabled`, préproduction en 401 (en-tête noindex
   vérifié seulement avec l'identifiant de revue).
2. Navigateur, desktop 1440 et mobile 390 (`tests/recette/controle-public.spec.ts`) : pages principales (200, titre,
   médias chargés, aucun message d'erreur technique), fiches produit (prix d'appel = montant rouvert par
   « Configurer », configuration de départ jamais bloquée ni en erreur), étapes / Retour / actualisation,
   administration protégée, aucune donnée de coût ou de marge dans les pages publiques.
3. Prix (`tests/recette/prix-pdf.spec.ts`, mode lecture seule) : montants attendus recalculés depuis la référence PDF
   (réextraite à chaque contrôle) — HelioLux 3 700 × 3 990 et 1 500 × 2 000 (murale, autoportante, hauteur 2 450),
   sous-total avec HelioSlide VERRE, ancienne toile `serge_100` puis correction, HelioMax, HelioSun.

## Rapport

`private/recette/controle-production/<horodatage>/rapport.md` (privé) et `resume-public.md` : date, environnement,
commit exécuté, empreinte de la référence ; Réussi / Échoué / Non testé / Bloqué / Sans objet ; traces des échecs.
Annoncer le résultat tel quel ; un test « non testé » ou « bloqué » n'est jamais présenté comme réussi.
