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
| 6 / 8 | SOLID : hauteur hors norme (2,50–3,00 m) | supplément HelioLux selon la pose |
| 10–11 / 12–13 | SB 450 : centrale radio, capteur pluie et antigel, poteau supplémentaire | options HelioMax |
| 17 / 19 | SOLID autoportante et murale, premier module et module suivant ; poteau supplémentaire | grilles et option HelioLux |
| 19 / 21 | éclairage SOLID (une barre sur deux, chaque barre) | options HelioLux (tableaux avancée × largeur) |
| 20 / 22 | éclairage SB 450 lame F (lames, spots, couronne) | options HelioMax |
| 22 / 24 | parois SLIDE (modules lames 52 mm et toile) | données tracées (HelioSlide ALU : correspondance non confirmée) |
| 24 / 26 | parois OPEN SLIDE (vitrage non inclus) | données tracées (HelioSlide VERRE) |
| 65 / 67 | informations screens : teintes, forfait RAL | HelioScreen, HelioRoof |
| 69 / 71 | REFLEKSOL ZIIIP 120 : grille hauteur × largeur, moteurs | grille HelioScreen, plus-values moteur |
| 90 / 92 | VÉRANDA V ZIIIP (moteur io ou filaire compris) | grille HelioRoof |
| 94 / 96 | informations stores bannes : teintes, suppléments | HelioSun, HelioShade, HelioPro, HelioSquare |
| 96 / 98 | grilles CASABLANCA, JAMAICA, CORSICA, MADEIRA (CORSICA et MADEIRA : éclairage LED compris) | grilles des stores bannes (transcription contrôlée sur un rendu 3x) |
| 100–107 / 102–109 | moteurs et commandes des stores bannes, matrice moteur × store, couples | modes de commande des stores bannes |
| 109 / 111 | auvent JAMAICA selon la largeur | option HelioPro |
| 112–116 / 114–118 | commandes filaires, RTS et io, capteurs, box smartphone | options screens et stores |

Non utilisées : SB 550, SB 400 (modèles non proposés ou retirés), Pergola V ZiiiP p. 18 (≠ VÉRANDA V ZiiiP), VERANDA
FTS, BSO, autres screens, accessoires non proposés sur le site. Les pages 100–107 (texte altéré) sont relues sur rendu.

## 3. Correspondances et situation

| Produit | Système (privé) | Grille | Situation |
|---|---|---|---|
| HelioMax | SB 450 (lame F, standard) | p. 10–11 | **prix affichés** (autoportante, adossée) ; lame Z importée, non utilisée (aucun choix de lame sur le site) |
| HelioSky | SB 350 (lame 195 mm) | p. 16 | **prix affichés** (4 tailles fabriquées) ; lame 217,4 mm importée, non utilisée |
| HelioScreen | R 120 ZiiiP | p. 69 | **prix affichés** : grille + moteur du mode de commande choisi (montant si un seul moteur convient, fourchette « à chiffrer » sinon) |
| HelioSun | CASABLANCA | p. 96 | **prix complets** en manivelle et en commande filaire ; radio : moteur à chiffrer (fourchette) |
| HelioPro | JAMAICA | p. 96 | **prix complets** en manivelle ; motorisé : moteur à chiffrer (fourchette) ; auvent chiffré |
| HelioShade | CORSICA | p. 96 | **prix complet** en commande filaire ; radio : moteur obligatoire à chiffrer (fourchette) |
| HelioSquare | MADEIRA | p. 96 | **sous-total partiel** : un seul mode (radio io avec secours), plusieurs moteurs selon le couple |
| HelioLux | SOLID (confirmé le 2026-11-03) | p. 17 | **prix affichés** (autoportante, adossée) de 3 à 7 m d'avancée ; 2 à 3 m : devis |
| HelioRoof | VÉRANDA V ZiiiP (confirmé le 2026-11-03) | p. 90 | **prix affichés** ; jamais de donnée VERANDA FTS ni « Veranda » standard |
| HelioSlide VERRE | OPEN SLIDE | p. 24 | données tracées dans l'import, aucune grille (souhait de fermeture, vitrage non inclus) |
| HelioSlide ALU | SYSTEM SLIDE | absent | seul « PAROIS LATÉRALES SLIDE » (p. 22) existe : données tracées, correspondance à confirmer |
| Moustiquaires (5) | — | absentes | aucune moustiquaire dans ce catalogue : situation inchangée (demandes d'étude) |

## 3 bis. Modes de commande et options rapprochés (source : liste de prix)

Le client choisit un **mode de commande** compréhensible ; le moteur découle du produit, du mode et du couple exigé
par la cellule (screen : cellules « 20 Nm » ; stores : avancée, largeur, nombre de bras). Un seul moteur documenté →
montant ajouté ; plusieurs → **fourchette affichée, jamais ajoutée**, modèle confirmé au devis ; aucun → « non
disponible pour ces dimensions ». Le configurateur affiche le comparatif des modes (supplément ou fourchette) pour les
cotes saisies. Les désignations des moteurs et commandes restent dans la référence fournisseur (administration).

| Produit | Modes proposés | Options chiffrées (cible) | Source (index) |
|---|---|---|---|
| HelioScreen | filaire (fins de course mécaniques, électroniques, détection d'obstacles), radio RTS, radio io, radio io avec détection d'obstacles | télécommande RTS 1/5 canaux, io 1/5 canaux, capteur vent-soleil RTS, capteur vent ou vent-soleil io, box smartphone (RTS et io) | p. 69, 112–116 |
| HelioRoof | radio io, filaire (moteur compris) | télécommande io 1/5 canaux, capteur vent ou vent-soleil io, box ; interrupteur filaire à chiffrer | p. 90, 115–116 |
| HelioMax | moteur compris ; centrale radio ajoutée à toute configuration | télécommande io (4 modèles), capteur pluie et antigel, LED lames / spots (tableaux), LED périphérique, poteau supplémentaire × quantité selon la hauteur | p. 10–11, 20, 115 |
| HelioLux | radio et télécommande 5 canaux compris | hauteur hors norme > 2,50 m (selon la pose), LED une barre sur deux / chaque barre (exclusives), poteau supplémentaire × quantité | p. 6, 17, 19 |
| HelioSun / HelioPro | manivelle ; filaire, radio dédiée, radio RTS, radio io, radio io avec secours | box (RTS, io) ; auvent (HelioPro, pas en pose plafond) | p. 96, 100–109 |
| HelioShade | filaire, radio dédiée, radio RTS, radio io (motorisation obligatoire) ; LED comprise | box | p. 96, 100–107 |
| HelioSquare | radio io avec secours (seul moteur compatible) ; LED comprise | box | p. 96, 100–107 |

Double facturation évitée : un élément compris dans la grille (LED CORSICA / MADEIRA, moteur et télécommande SOLID,
moteur V ZiiiP) n'est jamais proposé en option ; la télécommande « à choisir » disparaît dès qu'un modèle est choisi ;
une exigence de cellule (20 Nm) remplace le moteur standard. Restent en souhait étudié au devis : capteurs non tarifés
pour le modèle (HelioSky, HelioMax vent-soleil, HelioLux, stores : vibrations), chauffage, fermetures, modules.

## 4. Règles de calcul (décision écrite du 2026-11-02)

1. **Prix de vente HELIOSTORES HT = prix catalogue HT** (coefficient 1). Remise revendeur (décision du 2026-11-04) :
   paramètre de coût interne versionné (prix d'achat net, marges), sans effet sur le prix public — `comparatif-marche.md`.
2. **Cote intermédiaire** : valeur de grille immédiatement supérieure, sur chaque axe ; une cote au-delà de la dernière
   valeur reste hors grille (devis) ; une largeur sous le début de la première plage d'une avancée n'est pas proposée.
   Aucune interpolation.
3. **Suppléments** (versionnés avec chaque grille) :
   - pourcentage : appliqué au prix de la structure (cellule) — assiette « prix du système après remise » du
     catalogue, la remise étant nulle pour le client ; chaque pourcentage arrondi au centime (demi supérieur), sans cumul ;
   - montant fixe : ajouté (plus-value du moteur choisi, forfait teinte RAL des screens) ;
   - « à chiffrer » : élément connu sans prix applicable (plusieurs moteurs possibles, télécommande à choisir,
     interrupteur) → **sous-total partiel**, listé avec la fourchette documentée quand elle existe ;
   - tableau : montant lu selon une cote (avancée, largeur ou hauteur ; valeur supérieure entre deux valeurs), éventuellement
     multiplié par la quantité choisie (poteaux) ; hors tableau → à chiffrer ;
   - « toujours » : montant ajouté à toute configuration (centrale radio HelioMax), compris dans le « à partir de ».
4. **Éléments choisis sans tarif** (options, fermetures, modules) : jamais retirés en silence, listés « à chiffrer ».
5. **TVA 20 %** ajoutée une fois au total HT (demi supérieur) ; le prix TTC est affiché à côté du HT.
6. **Livraison et pose** : toujours au devis, signalées.
7. Montants en **centimes entiers** ; serveur seul juge (devis et panier recalculés) ; un montant envoyé par le
   navigateur est ignoré. Les devis émis gardent leur décomposition figée.
8. « À partir de » : cellule la moins chère (plus les montants « toujours ») d'une variante sans élément obligatoire à
   chiffrer ; absent pour HelioScreen, HelioShade et HelioSquare.
9. **Anciens projets** (HelioLux, HelioRoof révisés le 2026-11-03) : jamais convertis ; avis de revalidation dans le
   configurateur (projet, ligne de panier ou brouillon enregistré avant la révision) ; toile, commande ou option
   devenue invalide nommée et à choisir de nouveau. Devis et PDF émis : décomposition figée, inchangée.

Exemple de calcul (sans montant) : HelioMax adossée 4,00 × 6,01 m, décor bois → cellule « murale, lame F, ligne
6 010, colonne 4 000 » (p. 11) + 20 % de cette cellule (p. 6) = total HT ; TTC = HT + 20 %. Exemples chiffrés (9
configurations, une par cas) : `private/heliostores/selt-2026-09/exemples-calcul.md`.

## 5. Import (fichier privé, idempotent)

1. Report normalisé contrôlé : `private/heliostores/selt-2026-09/extract.py` → `inputs/heliostores/selt-pricing/normalises/catalogue-2026-09.csv`
   (1 603 lignes : 1 258 cellules de grille dont 44 de parois tracées, 345 lignes de suppléments ; page imprimée, tableau,
   ligne et colonne pour chacune ; colonnes `mode`, `pourcentage`, `applique_a`, `exigence`, `obligatoire`, `axe`,
   `cote_min`, `cote_max`, `quantite_selon`, `fourchette_min`, `fourchette_max`). Cibles composées : `&` (toutes),
   `!` (négation), `option:<code>=<valeur>`, `cote:hauteur>2500`.
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

Production (fichier monté en lecture seule, ponctuellement) : runbook § 2 quinquies. Une nouvelle version publiée remplace
la version en vigueur à la date de publication (aucun chevauchement fictif avec la date de validité du catalogue).

## 6. Administration (Administration → Tarifs, `/admin/tarifs`)

- **Consulter** : liste par produit, variante et nature (catalogue fournisseur, vente) ; grille cliquable (origine de
  chaque cellule : fichier, page, ligne, colonne).
- **Modifier** : une version publiée n'est jamais modifiée — « Modifier (nouveau brouillon) », puis cellules
  (saisie, action groupée) et **suppléments** (mode, montant ou %, cible, obligatoire, règle) ; l'auteur et la date
  de chaque valeur modifiée sont enregistrés ; la valeur précédente reste dans la version antérieure.
- **Comparer** : brouillon / version publiée ou grille catalogue (écarts par cellule, en %).
- **Simuler** (`/admin/tarifs/simulateur`) : produit, pose, cotes, teinte, commande, options, version (brouillon
  compris) → A prix catalogue fournisseur HT, B prix d'achat net (politique de coût en vigueur ; postes d'éligibilité
  inconnue signalés), C prix de vente HT, D prix public TTC, et décomposition. Marges, comparables et recommandation :
  Comparatif marché (`docs/pricing/comparatif-marche.md`).
- **Valider et publier** : « Vérifier la grille » (contrôles bloquants) puis « Publier » (immédiat ou programmé) ;
  caches du catalogue et de l'aide immédiate vidés.
- **Revenir en arrière** : « Désactiver cette version » (le produit repasse au devis), puis « Reprendre en brouillon »
  la version voulue, la vérifier et la publier.
- **Recalculer** une grille de vente depuis la grille catalogue (coefficient, majoration, marge) : nouveau brouillon,
  suppléments compris.
- Devis (Administration → Devis) : décomposition figée à l'émission et réévaluation au tarif du jour (information).

## 7. Décisions et données encore attendues

Aucune ne bloque les prix affichés : chaque point reste « à chiffrer » ou au devis tant qu'il n'est pas confirmé.

1. Remise revendeur : 37 % décidée le 2026-11-04 (interne) ; éligibilité des postes fixes (centrale, moteurs,
   télécommandes, LED, poteaux) à confirmer — n'influe pas sur le prix public décidé.
2. Livraison et pose : chiffrées séparément au devis (aucun forfait) ; délai indiqué 4 à 7 semaines.
3. Paiement en ligne : non activé (chantier distinct).
4. Questions fournisseur : tableau `docs/pricing/questions-fournisseur-2026-11.md`.
