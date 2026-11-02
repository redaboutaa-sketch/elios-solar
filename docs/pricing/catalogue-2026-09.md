# Catalogue de prix 09.2026 — import, règles, administration et activation

> Document publiable : aucun montant. Les montants, le fichier source, son report normalisé et les exemples chiffrés
> restent privés : `inputs/heliostores/selt-pricing/` et `private/heliostores/selt-2026-09/` (hors Git, hors Docker).

## 1. Source et indications vérifiées

| Élément | Constat (lecture du fichier et contrôle visuel) |
|---|---|
| Fichier | `7254168cenniki_SOP_wyrob_gotowy_FR.pdf`, 120 pages, sha256 `aa1e1ff9…82d7b` (empreinte complète dans le registre d'import) |
| Éditeur | « Liste des prix des produits finis » du fournisseur (division protections solaires) ; SELT n'y est cité que comme fabricant de toiles |
| Devise / taxes | chaque page : « prix indiqués en €, prix hors taxes » |
| Validité | « valable à partir du 15 septembre 2026 », aucune date de fin |
| Nature | « liste des prix » ; « le prix catalogue n'est pas réduit » (p. 22) : **prix catalogue avant remise revendeur** ; taux de remise non indiqué ; ni prix d'achat net, ni prix de vente public |
| Hausse antérieure | aucune mention d'augmentation : aucun courrier de hausse appliqué (pas de double hausse) |
| Suppléments | pourcentages « du prix du système après application de la remise » (pergolas, V ZiiiP, Open Slide, stores bannes) ; forfaits (teinte RAL des screens, moteurs) |
| Arrondi entre deux cotes | aucune règle : décision du client du 2026-11-02 (dimension supérieure) |
| Numérotation | page imprimée = page du PDF + 2 |

## 2. Pages utilisées (index PDF / imprimée)

| Pages | Contenu | Usage |
|---|---|---|
| 1–2 / 3–4 | couverture (validité), sommaire | indications générales |
| 6 / 8 | informations pergolas, suppléments | RAL hors palette, imitation bois, évacuation par un poteau |
| 10–11 / 12–13 | SB 450 autoportante et murale, lames F et Z | grilles HelioMax |
| 16 / 18 | SB 350, lames 195 et 217,4 mm | grille HelioSky (lame 195 = tailles du site) |
| 17 / 19 | SOLID autoportante et murale, premier module et module suivant | grilles HelioLux (préparées) |
| 22 / 24 | parois SLIDE (modules lames 52 mm et toile) | données tracées (HelioSlide ALU : correspondance non confirmée) |
| 24 / 26 | parois OPEN SLIDE (vitrage non inclus) | données tracées (HelioSlide VERRE) |
| 65 / 67 | informations screens : teintes, forfait RAL | HelioScreen, HelioRoof |
| 69 / 71 | REFLEKSOL ZIIIP 120 : grille hauteur × largeur, moteurs | grille HelioScreen, plus-values moteur |
| 90 / 92 | VÉRANDA V ZIIIP | grille HelioRoof (préparée) |
| 94 / 96 | informations stores bannes : teintes, suppléments | HelioSun, HelioShade, HelioPro, HelioSquare |
| 96 / 98 | grilles CASABLANCA, JAMAICA, CORSICA, MADEIRA | grilles des stores bannes (transcription contrôlée sur un rendu 3x) |

Non utilisées : SB 550, SB 400 (modèles non proposés ou retirés), Pergola V ZiiiP p. 18 (≠ VÉRANDA V ZiiiP), BSO,
autres screens, éclairages, motorisations des stores bannes (p. 100–107, tableaux altérés), accessoires.

## 3. Correspondances et situation

| Produit | Système (privé) | Grille | Situation |
|---|---|---|---|
| HelioMax | SB 450 (lame F, standard) | p. 10–11 | **prix affichés** (autoportante, adossée) ; lame Z importée, non utilisée (aucun choix de lame sur le site) |
| HelioSky | SB 350 (lame 195 mm) | p. 16 | **prix affichés** (4 tailles fabriquées) ; lame 217,4 mm importée, non utilisée |
| HelioScreen | R 120 ZiiiP | p. 69 | **prix affichés** : grille + plus-value du moteur choisi quand elle est établie ; sinon moteur « à chiffrer » (sous-total partiel) |
| HelioSun | CASABLANCA | p. 96 | **prix affichés** (manivelle incluse) ; moteur à chiffrer si motorisation choisie |
| HelioPro | JAMAICA | p. 96 | **prix affichés** (manivelle incluse) ; moteur à chiffrer si motorisation choisie |
| HelioShade | CORSICA | p. 96 | **sous-total partiel affiché** : le moteur, obligatoire, s'ajoute au prix de la grille et n'est pas chiffré |
| HelioSquare | MADEIRA | p. 96 | **sous-total partiel affiché** : idem |
| HelioLux | SOLID | p. 17 | grilles importées, vente **préparée, non publiée** : la fiche du site reprend encore les caractéristiques d'un autre système |
| HelioRoof | VÉRANDA V ZiiiP | p. 90 | grille importée, vente **préparée, non publiée** : même raison |
| HelioSlide VERRE | OPEN SLIDE | p. 24 | données tracées dans l'import, aucune grille (souhait de fermeture, vitrage non inclus) |
| HelioSlide ALU | SYSTEM SLIDE | absent | seul « PAROIS LATÉRALES SLIDE » (p. 22) existe : données tracées, correspondance à confirmer |
| Moustiquaires (5) | — | absentes | aucune moustiquaire dans ce catalogue : situation inchangée (demandes d'étude) |

## 4. Règles de calcul (décision écrite du 2026-11-02)

1. **Prix de vente HELIOSTORES HT = prix catalogue HT** (coefficient 1) ; remise revendeur (prix d'achat net) non
   communiquée : aucune valeur supposée, jamais affichée.
2. **Cote intermédiaire** : valeur de grille immédiatement supérieure, sur chaque axe ; une cote au-delà de la dernière
   valeur reste hors grille (devis) ; une largeur sous le début de la première plage d'une avancée n'est pas proposée.
   Aucune interpolation.
3. **Suppléments** (versionnés avec chaque grille) :
   - pourcentage : appliqué au prix de la structure (cellule) — assiette « prix du système après remise » du
     catalogue, la remise étant nulle pour le client ; chaque pourcentage arrondi au centime (demi supérieur), sans cumul ;
   - montant fixe : ajouté (plus-value du moteur choisi, forfait teinte RAL des screens) ;
   - « à chiffrer » : élément connu sans prix applicable (moteur obligatoire des stores motorisés, moteur 20 Nm exigé
     par certaines cellules du screen, modèle de moteur sans plus-value identifiée) → **sous-total partiel**, listé.
4. **Éléments choisis sans tarif** (options, fermetures, modules) : jamais retirés en silence, listés « à chiffrer ».
5. **TVA 20 %** ajoutée une fois au total HT (demi supérieur) ; le prix TTC est affiché à côté du HT.
6. **Livraison et pose** : toujours au devis, signalées.
7. Montants en **centimes entiers** ; serveur seul juge (devis et panier recalculés) ; un montant envoyé par le
   navigateur est ignoré. Les devis émis gardent leur décomposition figée.
8. « À partir de » : cellule la moins chère d'une configuration complète (aucun élément obligatoire à chiffrer) ;
   absent pour HelioScreen, HelioShade et HelioSquare.

Exemple de calcul (sans montant) : HelioMax adossée 4,00 × 6,01 m, décor bois → cellule « murale, lame F, ligne
6 010, colonne 4 000 » (p. 11) + 20 % de cette cellule (p. 6) = total HT ; TTC = HT + 20 %. Exemples chiffrés (9
configurations, une par cas) : `private/heliostores/selt-2026-09/exemples-calcul.md`.

## 5. Import (fichier privé, idempotent)

1. Report normalisé contrôlé : `private/heliostores/selt-2026-09/extract.py` → `inputs/heliostores/selt-pricing/normalises/catalogue-2026-09.csv`
   (1 282 lignes : 1 258 cellules de grille dont 44 de parois tracées, 24 suppléments ; page imprimée, tableau, ligne et
   colonne pour chacune ; colonnes `mode`, `pourcentage`, `applique_a`, `exigence`, `obligatoire`).
2. Contrôles : relecture indépendante par position des mots (1 092 cellules de pergolas, screen et véranda retrouvées
   à leur colonne, 0 écart) ; stores bannes vérifiés sur un rendu 3x ; plus-values moteur relevées sur l'image (texte
   multicolonne non fiable) ; anomalies d'extraction corrigées (caractères du bandeau latéral, en-têtes « [cm] »
   erronés : valeurs en mm). Trois états distincts : cellule absente = combinaison non proposée ; montant vide = prix
   manquant (bloque la vérification) ; zéro refusé.
3. `tsx scripts/pricing-catalogue.ts --file <csv> [--apply [--publish]]` : import tracé → grilles « prix catalogue
   fournisseur » (internes) avec suppléments → grilles de vente (coefficient 1, TVA 20 %, dimension supérieure) →
   vérification et publication des seuls produits activables. Répété : aucune nouvelle version ; un brouillon modifié
   dans l'administration n'est jamais écrasé.
4. Contrôle final sur la base : `NODE_OPTIONS="--require ./scripts/lib/server-only-shim.cjs" tsx scripts/pricing-check.ts --file <csv>`
   compare chaque cellule du fichier au prix du moteur de la boutique (cote exacte et cote intermédiaire).

Production (fichier monté en lecture seule, ponctuellement) : runbook § 2 quinquies.

## 6. Administration (Administration → Tarifs, `/admin/tarifs`)

- **Consulter** : liste par produit, variante et nature (catalogue fournisseur, vente) ; grille cliquable (origine de
  chaque cellule : fichier, page, ligne, colonne).
- **Modifier** : une version publiée n'est jamais modifiée — « Modifier (nouveau brouillon) », puis cellules
  (saisie, action groupée) et **suppléments** (mode, montant ou %, cible, obligatoire, règle) ; l'auteur et la date
  de chaque valeur modifiée sont enregistrés ; la valeur précédente reste dans la version antérieure.
- **Comparer** : brouillon / version publiée ou grille catalogue (écarts par cellule, en %).
- **Simuler** (`/admin/tarifs/simulateur`) : produit, pose, cotes, teinte, commande, options, version (brouillon
  compris) → A prix catalogue fournisseur HT, B prix d'achat net (non établi), C prix de vente HT, D prix public TTC,
  et décomposition.
- **Valider et publier** : « Vérifier la grille » (contrôles bloquants) puis « Publier » (immédiat ou programmé) ;
  caches du catalogue et de l'aide immédiate vidés.
- **Revenir en arrière** : « Désactiver cette version » (le produit repasse au devis), puis « Reprendre en brouillon »
  la version voulue, la vérifier et la publier.
- **Recalculer** une grille de vente depuis la grille catalogue (coefficient, majoration, marge) : nouveau brouillon,
  suppléments compris.
- Devis (Administration → Devis) : décomposition figée à l'émission et réévaluation au tarif du jour (information).

## 7. Décisions et données encore attendues

1. Remise revendeur (prix d'achat net, interne) — n'influe pas sur le prix public décidé.
2. HelioScreen : correspondance des moteurs proposés sans plus-value identifiée (modèles 1, 2, 4) et offre d'un moteur
   20 Nm pour les grandes dimensions.
3. HelioShade, HelioSquare (et motorisation d'HelioSun, HelioPro) : moteur retenu par largeur (p. 100–107) pour
   compléter le prix.
4. HelioLux (SOLID) et HelioRoof (VÉRANDA V ZiiiP) : caractéristiques du site à aligner sur ces systèmes, puis
   publication des grilles préparées.
5. Options (éclairage, capteurs, poteaux, centrale radio) : correspondance option du site ↔ ligne du catalogue.
6. HelioSlide : correspondance SYSTEM SLIDE ; mode de chiffrage d'une fermeture (largeur du côté, nombre de panneaux,
   vitrage).
7. Livraison et pose ; paiement en ligne (chantier distinct, non activé).
