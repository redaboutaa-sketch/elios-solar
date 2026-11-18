# Audit de couverture tarifaire par dimensions (2026-11-18)

> Document publiable : aucun montant. Les montants (catalogue, vente, TTC final de chaque configuration testée) sont
> dans le dossier privé `private/audit-tranches-2026-11-18/` (`bilan.md`, script `audit.ts`, export des grilles
> actives), hors Git.

Source unique : liste de prix 09.2026 (`7254168cenniki_SOP_wyrob_gotowy_FR.pdf`, 120 pages, sha256 `aa1e1ff9…82d7b`,
« valable à partir du 15 septembre 2026 »), vérifiée avant usage. Pages citées en numérotation **imprimée** (= index
PDF + 2). Grilles contrôlées : versions de vente actives en production le 2026-11-18 (15 versions, 1 305 lignes).

## 1. Règle commerciale (décision HELIOSTORES du 2026-11-18)

Pour une configuration **techniquement admissible**, le prix est celui de la **plus petite tranche tarifaire supérieure
ou égale** aux dimensions réelles, sur chaque axe. Sous la première tranche, la **première tranche** sert de minimum de
facturation, à trois conditions vérifiées par le moteur :

1. la cote respecte le **minimum technique documenté** de l'axe (`systemRules.dims`, valeur citée par la source) ; un
   minimum non documenté n'autorise jamais ce report ;
2. la grille est celle du produit **et de son implantation** (variante murale / autoportante, jamais l'autre) ;
3. la grille porte la règle « tranche supérieure » (`dimRule = ROUND_UP`, décision écrite du 2026-11-02).

C'est une décision commerciale HELIOSTORES, pas une règle du fournisseur : le catalogue ne dit rien du prix sous sa
première tranche. Jamais d'interpolation ni d'extrapolation ; au-delà de la dernière tranche : pas de prix ; une
cellule absente (vide ou interdite) n'est jamais remplacée par une cellule voisine ; jamais de changement de système
ou de pose pour obtenir un montant ; les dimensions réelles ne sont jamais agrandies (champ, dessin, 3D,
récapitulatif, devis).

Les tableaux de suppléments selon une cote (éclairage selon l'avancée et la largeur, poteau selon la hauteur) suivent la
même règle, avec la même condition de domaine technique.

## 2. Quatre types de règles

| Type | Où | Contenu |
|---|---|---|
| A. Domaine technique | `systemRules` (code, `src/server/catalog/**`, synchronisé par `catalogue-sync`) | bornes, valeurs fixes, largeur minimale par avancée, largeur minimale par mode de commande (moteur), poses, options, incompatibilités |
| B. Grille tarifaire | versions de grille (Administration → Tarifs) | axes, tranches, variantes par pose, cellules présentes ; cellule absente = combinaison non tarifée |
| C. Règles commerciales | moteur (`lookupSystemPrice`, `lookupSupplementTable`, `priceBreakdown`) et version de grille | tranche supérieure, première tranche comme minimum, politique de vente v3, arrondi TTC 99 € |
| D. Informations manquantes | suppléments « à chiffrer » | moteur non déterminable, supports de pose, interrupteur, éléments sans tarif : sous-total partiel explicite |

## 3. Tableau de couverture

Unités : les en-têtes « [cm] » des grilles pergola, véranda et store banne portent des valeurs en millimètres (1 500…
7 000) ; la normalisation est faite à l'import d'après les dimensions techniques (largeur maximale 4 m, avancée 7 m…),
jamais d'après le libellé. Les largeurs minimales des moteurs de screen (« 61 cm ») sont bien en centimètres.

| Produit | Variante | Bornes techniques (source) | Bornes tarifaires | Sélection | Prix | Cause d'un devis ou d'un partiel | Page |
|---|---|---|---|---|---|---|---|
| HelioLux (SOLID) | murale, autoportante | largeur 1 500–4 000, avancée 2 000–7 000 (« dimensions minimales : largeur 1 500 mm et projection 2 000 mm ») ; hauteur ≤ 3 000, hors norme > 2 500 | largeur 1 500–4 000 / 500 ; avancée 3 000–7 000 / 500 ; premier module | tranche supérieure ; avancée 2 000–2 999 → tranche 3 000 | complet (moteur, radio et télécommande 5 canaux compris) | hauteur > 2,50 m : supplément selon la pose ; modules suivants, fermetures : devis | 19, 8 |
| HelioMax (SB 450 lame F) | murale, autoportante | largeur 1 000–4 000, avancée 1 318–6 010 (« largeur 1000 mm … lame F 1318 mm ») | largeur 1 500–4 000 / 500 ; avancée 1 930–6 010 / 204 | tranche supérieure ; largeur < 1 500 → 1 500 ; avancée < 1 930 → 1 930 | complet avec la centrale radio (toujours) et une télécommande choisie | télécommande non choisie : à chiffrer (fourchette) ; capteurs vent/soleil : souhait | 12–13 |
| HelioSky (SB 350) | autoportante | 4 tailles fabriquées 3 500 × 3 400 / 3 850 / 4 300 / 4 750 | 4 cellules | taille fabriquée (aucune autre cote) | complet | hors gamme : devis | 18 |
| HelioScreen (R 120 ZiiiP) | façade, niche | largeur ≤ 7 000 ; largeur minimale selon le moteur du mode : 640 (filaire mécanique), 750 (filaire électronique), 700 (autres) ; hauteur ≤ 4 000, minimum non documenté | hauteur 1 000–4 000 / 250 ; largeur 1 000–7 000 / 250 ; cellules « barre élargie incluse » (≤ 1 500) et « 20 Nm » | tranche supérieure ; largeur 640–999 → 1 000 si le moteur l'admet | complet en radio io, RTS, filaire à détection, avec télécommande choisie | filaire mécanique ou électronique : moteur et interrupteur à chiffrer (plusieurs moteurs) ; RTS ou filaire électronique en cellule 20 Nm : non disponible ; hauteur < 1 000 : devis (minimum non documenté) | 71 |
| HelioRoof (VÉRANDA V ZiiiP) | toiture | largeur 2 000–5 000, avancée 2 000–6 000 | identiques, pas de 500 | tranche supérieure | complet en radio io avec télécommande (moteur compris) | filaire : interrupteur à chiffrer ; teinte hors standard : + % | 92 |
| HelioSun (CASABLANCA) | unique | avancées 1 600 / 2 100 / 2 600 / 3 100 / 3 600 ; largeur 2 000–6 000, min. = avancée + 400 | plages de largeur par avancée (début = largeur minimale) | plage contenant la largeur ; écart entre deux plages → plage supérieure | complet en manivelle et filaire, pose murale | radio : moteur à chiffrer (plusieurs moteurs selon le couple) ; plafond, chevrons : supports à chiffrer | 98, 101 |
| HelioShade (CORSICA) | unique | avancées fixes ; largeur 2 050–7 000, min. = avancée + 450 ; motorisation obligatoire ; LED comprise | plages de largeur par avancée | idem | complet en filaire, pose murale | radio : moteur obligatoire à chiffrer ; plafond, chevrons : supports à chiffrer | 98, 101 |
| HelioPro (JAMAICA) | unique | avancées fixes ; largeur 2 050–7 000, min. = avancée + 450 | plages de largeur par avancée | idem | complet en manivelle, pose murale ; auvent chiffré selon la largeur | motorisé : moteur à chiffrer ; plafond, chevrons : supports à chiffrer | 98, 101 |
| HelioSquare (MADEIRA) | unique | avancées fixes ; largeur 2 050–6 000, min. = avancée + 450 ; pose murale ; radio io avec secours seule ; LED comprise | plages de largeur par avancée | idem | **partiel** | moteur radio io avec secours : deux moteurs de même classe de couple (40 et 50 Nm « selon le fabricant ») | 98, 105, 108 |
| HelioSlide VERRE (OPEN SLIDE) | fermeture de pergola | — | grille hauteur × panneaux, **vitrage non inclus** | — | devis | composant obligatoire (vitrage) sans tarif | 26 |
| HelioSlide ALU (SYSTEM SLIDE) | fermeture de pergola | — | **aucune grille** « SYSTEM SLIDE » (seulement « parois latérales SLIDE ») | — | devis | grille du système absente du catalogue | 24 |
| Moustiquaires (5 modèles) | — | non documentées | **aucune grille** | — | demande d'étude | aucune moustiquaire dans le catalogue 09.2026 | — |

## 4. Restrictions corrigées

| Constat (code ou données) | Correction |
|---|---|
| « Sous la première tranche = devis » (`lookupSystemPrice`, `publicCell` des tests) | première tranche quand la cote est dans le domaine technique documenté (HelioLux avancée 2–3 m ; HelioMax largeur 1–1,5 m et avancée 1,318–1,93 m ; HelioScreen largeur 0,64–1 m selon le moteur) |
| Même restriction dans les tableaux de suppléments (éclairage HelioLux sous 3 m d'avancée « à chiffrer ») | même règle, mêmes conditions |
| Cellule absente d'une ligne : la cellule suivante de la ligne était retenue | colonne immédiatement supérieure cherchée sur toute la grille ; absente de la ligne → « cellule vide ou interdite », jamais une voisine |
| HelioScreen : largeur minimale non documentée (« selon le moteur ») | largeur minimale par mode de commande, valeur la plus exigeante des moteurs possibles (aucun moteur choisi arbitrairement) |
| Store banne au plafond ou sur chevrons chiffré au prix de la pose murale (supports supplémentaires omis) | supports de cette pose listés « à chiffrer » : sous-total partiel, jamais présenté complet |
| HelioRoof : configuration par défaut sur une teinte hors standard (+ %, « à confirmer ») | première teinte standard établie |
| Prix d'appel : cellules « barre élargie incluse » écartées, plus petite configuration technique ignorée | l'évaluation décide ; à prix égal, la plus petite configuration est retenue (HelioLux 1,5 × 2 m, HelioMax 1 × 1,318 m, HelioScreen 0,70 × 1 m) |
| Motif unique « ces dimensions ne figurent pas dans la grille » | motif précis : au-delà de la dernière tranche, minimum non documenté, sous le minimum technique, largeur minimale de l'avancée, cellule vide ou interdite |
| Textes « de 3 à 7 m d'avancée », « en dessous, prix sur devis » (HelioLux) et question ouverte correspondante | textes alignés, question retirée |

Restrictions **légitimes conservées** : bornes techniques ; avancées fixes et largeur minimale par avancée des stores
bannes ; largeur minimale par moteur ; tailles fabriquées de HelioSky ; cellules 20 Nm sans moteur tarifé ; pose
hors grille (aucune grille d'une autre pose) ; HelioScreen sous 1 m de hauteur (minimum non documenté).

## 5. Traçabilité

`SystemPrice` (instantané du devis) enregistre séparément : cotes réelles (`requested`), cellule facturée
(`grid`, `cellWidth`), version de grille (`listVersion`, `versionId`), règle (`selection` : `exact`, `round_up`,
`first_tranche`), exigence de la cellule ; la décomposition liste équipements compris, suppléments et éléments à chiffrer.
Détail administrateur du devis : cotes réelles, tranche facturée, règle et source de la cellule (fichier, page,
ligne). Public : « Tarif calculé selon la tranche de dimensions supérieure. » seulement ; la tranche facturée n'est
pas affichée. Devis et PDF émis avant le 2026-11-18 : présentation inchangée (instantané sans `selection`).

## 6. Données fournisseur réellement manquantes

1. Moteur radio des stores bannes : la grille de couple (p. 108) donne une classe de couple selon l'avancée, la largeur
   et le nombre de bras, mais la classe B couvre 40 à 50 Nm « selon le fabricant » et certaines cellules admettent 2 ou
   3 bras ; question posée (`questions-fournisseur-2026-11.md`).
2. Supports de pose au plafond et sur chevrons des stores bannes : prix unitaires publiés (p. 101), mais
   application aux modèles concernés et unité « paire » à confirmer.
3. MADEIRA, avancée 2,10 m : grille « de 250 cm » contre règle générale « projection + 0,45 m » (2,55 m) : la règle la
   plus stricte est conservée.
4. HelioScreen : hauteur minimale de fabrication.
5. OPEN SLIDE : prix du vitrage ; SYSTEM SLIDE : grille ; moustiquaires : catalogue.
