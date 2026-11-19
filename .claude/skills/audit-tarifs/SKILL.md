---
name: audit-tarifs
description: Audit indépendant des tarifs HELIOSTORES contre le PDF fournisseur privé (liste de prix 09.2026) — A : PDF → base, B : référence → moteur serveur, C : navigateur → nouveau devis — avec politique commerciale (remise 37 %, marge 25 %, TVA, arrondi TTC 99 €). À utiliser après un import ou une publication de grille, ou pour prouver un prix.
argument-hint: "[--levels ABC] [--prod-a]"
disable-model-invocation: true
allowed-tools: Bash(scripts/recette/audit-tarifs/run.sh *) Bash(scripts/recette/env.sh *)
---

# /audit-tarifs — comparaison indépendante au PDF

Arguments : `$ARGUMENTS`.

## Principe d'indépendance (non négociable)

- La valeur attendue n'est **jamais** calculée par la fonction testée (`evaluate`, `lookupSystemPrice`,
  `priceBreakdown`), ni lue dans la base comme unique vérité, ni recopiée de la valeur obtenue.
- Un import réussi n'est pas une preuve de conformité : le niveau A relit le PDF lui-même.
- Référence : `scripts/recette/audit-tarifs/reference.py` réextrait le texte du PDF (pdfplumber, mise en page) et lit
  chaque grille contre la **structure attendue** du manifeste `scripts/recette/audit-tarifs/manifest.json` (axes,
  unités, pages, ancres, règles techniques, statut de contrôle visuel — aucun montant). Toute divergence est une
  anomalie ; une lecture ambiguë est une **incertitude** signalée, jamais une donnée inventée.
- Correspondances : HelioSky → SB 350 ; HelioMax → SB 450 (lame F) ; HelioLux → SOLID ; HelioScreen → R 120 ZiiiP ;
  HelioRoof → VÉRANDA V ZiiiP ; HelioSun → CASABLANCA ; HelioShade → CORSICA ; HelioPro → JAMAICA ; HelioSquare →
  MADEIRA ; HelioSlide ALU → SYSTEM SLIDE (absent du document) ; HelioSlide VERRE → OPEN SLIDE (vitrage non chiffré).
  Aucune ancienne association VZIP/FTS ; aucun tarif d'un autre système pour les moustiquaires (absentes du document).

## Prérequis

- PDF privé `inputs/heliostores/selt-pricing/7254168cenniki_SOP_wyrob_gotowy_FR.pdf` (empreinte vérifiée).
- Python 3 ; l'environnement `private/recette/.venv` (pdfplumber 0.11.10) est créé au premier lancement.
- Niveaux B et C : environnement isolé démarré (`scripts/recette/env.sh up`, voir `/recette-site`). Sans lui, ces
  niveaux sont « non testés » (jamais « réussis »).

## Lancer

```bash
scripts/recette/env.sh up                              # copie isolée anonymisée (si B/C)
scripts/recette/audit-tarifs/run.sh --levels ABC --prod-a
scripts/recette/env.sh down
```

- A : `compare_db.py` — chaque cellule vendue du PDF → grille de vente active (copie, et production en LECTURE SEULE
  avec `--prod-a`) : cellule absente, en trop, doublon, unité, largeur minimale, catalogue de base ≠ PDF,
  vente ≠ catalogue × (1 − 37 %) ÷ (1 − 25 %), politique de dérivation, TVA, arrondi `NEAREST_99_TTC`, justification
  de la règle « tranche supérieure ».
- B : `engine-check.ts` — pour chaque cellule : cote exacte, cote intermédiaire (tranche ≥), au-delà de la dernière
  tranche (aucun prix), sous la première tranche avec minimum technique documenté (première tranche), sous le minimum
  technique (aucun prix), cas HelioLux signalés ; cotes réelles conservées ; TTC arrondi comparé quand le moteur ne
  présente que la structure. Conflits documentés (`knownConflicts` du manifeste) : « sans objet » avec justification.
- C : `tests/recette/prix-pdf.spec.ts` — montant visible (desktop et mobile), sous-total avec fermeture vitrée, ancienne
  toile `serge_100`, nouveau devis (montant, cotes réelles, cellule facturée) ; HelioMax (cellule dans le détail),
  HelioSun (prix complet).

## Rapports (PRIVÉS : montants et informations fournisseur)

`private/recette/audit-tarifs/<horodatage>/` : `reference.json` (fichier, empreinte, version, page PDF et imprimée,
grille, ligne, colonne, produit, variante, dimensions et unités, valeur catalogue, inclus, statut de contrôle visuel),
`reference-anomalies.json`, `ecarts-A-*.json`, `engine-B.json`, `playwright-recette.json`. Ne jamais les commiter ni les
coller dans un message public ; le résumé publiable ne donne que des nombres de cellules et d'écarts.

## Portée et CI

- Audit **intégral** : sur le VPS seulement (le PDF n'est pas dans Git).
- CI : tests unitaires à grilles **fictives** de même structure (`tests/unit/tranche-superieure.test.ts`,
  `system-pricing.test.ts`, `ttc-rounding.test.ts`) et cohérence du manifeste (`tests/unit/recette-manifest.test.ts`).
  La CI ne contrôle donc ni les montants réels ni la conformité au PDF : ne jamais l'annoncer comme un contrôle du catalogue.

## Ce qu'il ne faut pas faire

Modifier la politique commerciale, une règle fournisseur inconnue ou une valeur attendue pour obtenir un test vert ;
activer une donnée ambiguë ; attribuer un prix à une configuration dont un composant obligatoire n'est pas chiffré
(présenter un sous-total, jamais un prix complet).
