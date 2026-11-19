# Politique de vente par défaut, prix d'appel et « Mes prix conseillés » (2026-11-13)

Aucun montant dans ce document (dépôt public). Les montants se consultent dans l'administration (réservée aux
administrateurs) et dans le dossier privé `private/heliostores/market-2026-11/`.

## 1. Politique de vente par défaut : marge brute produit cible

Décision du client du 2026-11-13 (mission) : remise revendeur inchangée sur les lignes éligibles, **marge brute cible
25 % du prix de vente HT**, publication autorisée après vérification.

- achat net HT = catalogue HT × (1 − remise) sur une ligne éligible ; catalogue HT si la ligne est déclarée non éligible ;
- vente HT = achat net HT ÷ (1 − marge cible), arrondie au centime (demi supérieur) ;
- produit entièrement éligible : vente = catalogue × 0,84 ; contrôle : catalogue 4 000 € → achat 2 520 € → vente
  3 360 € → marge 840 € = 25 % du prix de vente (majoration du coût : 33,33 %, à ne pas confondre) ;
- ligne d'**éligibilité inconnue** (moteurs, télécommandes, centrales, LED… tant que le fournisseur ne l'a pas
  confirmée) : prix de vente **conservé**, jamais × 0,84 ; la marge cible n'est pas promise (signalée « marge non
  garantie », marge prudente affichée) ;
- pourcentage du catalogue (« % du prix du système après remise ») : taux inchangé, appliqué au prix de vente de la
  structure (aucune seconde remise) ; « à chiffrer » : inchangé ;
- exceptions commerciales validées : **aucune** (toutes les grilles de vente étaient égales au catalogue × 1, vérifié
  ligne à ligne avant recalcul) ;
- la marge brute ne déduit ni livraison, pose, frais de paiement, acquisition, SAV ni commission : ces coûts sont
  affichés séparément quand ils sont connus ; une donnée absente ne vaut pas zéro ; ce n'est jamais un bénéfice net.

Mise en œuvre : taux versionné dans la politique de coût (`CostPolicyVersion.marginTargetBps`, nouvelle version, les
anciennes conservées). Les grilles sont recalculées par le moteur des grilles (`derivePolicySaleGrid`,
`src/server/tariffs/grids.ts`) depuis le catalogue fournisseur dont la vente en vigueur est issue : aperçu, brouillons,
puis publication explicite (vérification + publication ; versions précédentes archivées, reprenables en brouillon).
Exploitation : `scripts/default-pricing.ts` ou Administration → Tarifs → Mes prix conseillés → « Politique par défaut ».

Devis, commandes et PDF existants : jamais modifiés (instantané du devis). Projets enregistrés non contractualisés :
réévalués (`--projects`) ; le client voit l'avis « prix mis à jour » à l'ouverture. Paiement : toujours désactivé.

## 1 bis. Arrondi commercial TTC (2026-11-13)

Décision du client du 2026-11-13 (remplace une demande d'arrondi HT, jamais livrée) : **total TTC de chaque
configuration complète à la terminaison « 99 € » la plus proche** (99, 199, 299…), égalité au montant supérieur, montant
déjà terminé par 99 € inchangé, sous 99 € TTC inchangé (signalé dans l'administration).

Ordre : vente HT à la marge cible (grille) → TTC (TVA de la grille, demi-centime supérieur) → **un seul** arrondi du
total TTC → HT final = TTC ÷ (1 + taux), au centime (demi supérieur) → TVA = TTC − HT. Le TTC affiché, enregistré et
repris dans le devis est exactement le montant commercial ; l'éventuel centime d'écart entre cette TVA et la TVA
recalculée sur le HT final est conservé (`ventilationMinor`). Une configuration n'a qu'un taux de TVA (celui de sa
grille) : aucune ventilation multi-taux n'est nécessaire aujourd'hui.

- Toujours recalculé depuis les montants de la grille (jamais depuis un prix déjà arrondi) ; une seule ligne
  « Arrondi commercial » (part HT de l'ajustement) dans la décomposition, jamais un arrondi par composant ;
- décomposition : HT calculé, TTC calculé, ajustement TTC et sa part HT, HT final, TVA, TTC final ;
- sous-total partiel : aucun arrondi, éléments à chiffrer conservés ;
- réglage versionné : politique de coût (`saleRounding`), recopié dans chaque version de vente recalculée ; désactivation
  = nouvelle version de la politique, puis recalcul des grilles ; historique conservé ;
- garde-fou : une grille dont l'arrondi ramènerait une cellule sous le coût d'achat connu n'est pas publiée
  automatiquement (validation manuelle) ;
- la marge de 25 % est une cible **avant** arrondi ; la marge réelle après arrondi est affichée (Mes prix conseillés →
  « Arrondi commercial TTC ») ; « marge non garantie » si un coût est inconnu ;
- coûts d'achat, prix catalogue, remises et devis existants : inchangés (un devis émis garde sa présentation PDF).

## 2. Prix d'appel (« À partir de … € TTC »)

Calcul serveur (`src/domain/entry-price.ts`) avec le moteur de la boutique et la version publiée en vigueur, recalculé
à chaque nouvelle version du catalogue ; aucun montant saisi dans les composants.

- configuration de départ : cellule de la grille (ou taille fabriquée) **et plus petite configuration technique
  documentée** (minimums des sources, largeur minimale du moteur ; chiffrée à la première tranche — décision du
  2026-11-18, `audit-couverture-dimensions.md`), première teinte standard, première toile, chaque mode de commande
  proposé, aucune option facultative ; toutes les cellules, exigences comprises (l'évaluation décide de la complétude) ;
  à prix égal, la plus petite configuration est retenue ; un choix rendu obligatoire par la grille (ex. télécommande à
  choisir) est complété par chaque valeur chiffrée ; un composant obligatoire n'est jamais retiré ;
- seules les configurations sans blocage ni élément « à chiffrer » donnent un prix d'appel complet ; la moins chère est
  retenue et la plus petite configuration valide est comparée (écart documenté s'il existe) ;
- affichage : TTC (TVA française validée) puis HT, dimensions, pose et équipements de base ; « Configurer » ouvre le
  configurateur sur cette configuration (`?depart=1`) et retrouve le même prix ;
- élément obligatoire non chiffré (HelioSquare : moteur radio io avec secours) : « Sous-total de la configuration de
  départ … ; <élément> : à chiffrer au devis », jamais présenté comme prix complet, aucun prix structuré ;
- livraison et pose : non comprises (inchangé) ; aucune gratuité, promotion ni prix barré.

## 3. « Mes prix conseillés » (`/admin/tarifs/prix-conseilles`)

Accès : tableau de bord et Administration → Tarifs ; administrateurs seulement (page, actions ; aucun export public).
Depuis le 2026-11-19 : **benchmark par niveaux, configuration par configuration** (méthode, diagnostic et résultats :
`docs/pricing/benchmark-europe.md`). Pour chaque produit, configuration d'appel et tailles courantes disponibles :
mon prix TTC, prix à la marge cible, fourchette marché comparable, prix conseillé ou fourchette indicative, marge
estimée (avant / après arrondi TTC), vendeurs indépendants (A / B / contexte), statut (« Comparaison directe »,
« Positionnement indicatif — différences documentées », « Produit seul comparé — livraison inconnue », « Données à
actualiser », « Données insuffisantes » avec les champs manquants), date de dernière vérification, « Comprendre »
(offres A, B, C, D séparées, liens, prix normal et promotionnel, périmètre, différences, exclusions, calcul) et
« Préparer un brouillon » (une seule cellule, affichée ; publication manuelle). Le prix conseillé reste celui de la
marge cible tant qu'il n'y a pas au moins trois vendeurs directs indépendants ; un marché sous la marge cible est
affiché comme conflit. Aucune collecte au chargement, aucune publication automatique.

## 4. Relevés du 2026-11-13

105 relevés publics vérifiés (fichier privé `releves-2026-11-13.json`), même schéma que le 04/11 ; une offre relevée de
nouveau archive l'ancien relevé (historique conservé). Contrôle manuel d'un échantillon : une offre déclassée (TTC non
affiché, télécommande non précisée). Principales raisons d'exclusion : livraison inconnue chez le concurrent alors
qu'elle est facturée à part chez nous, mention HT/TTC absente, promotion, motorisation ou équipements différents,
dimensions. Détail des sources : `docs/pricing/comparatif-marche.md`.
