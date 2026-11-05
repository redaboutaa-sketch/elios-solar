# Sur quelles données reposent les prix ? (revue interne)

> Document publiable : aucun montant, aucun coefficient. L'exemple chiffré est dans l'annexe privée
> `private/heliostores/prices/explication-prix-exemple.md` (hors dépôt). Les montants se consultent dans
> l'administration : Tarifs (réservé aux administrateurs).

## 1. Fichiers et versions

| Fichier | Version | Empreinte | Importé le | Rôle |
|---|---|---|---|---|
| `SITUATION DES TARIF.xlsx` (5 feuilles : SB500, SB400, REFLEKSOL 120 ZIP, STORE BANNE CASA, VERANDA FTS) | import v1 | `d9e57623dcd6…` | 2026-10-20 | seule source des prix affichés |
| 5 fiches techniques « AVEC_PRIX » (.docx) | import v1 chacune | — | 2026-10-20 | rapprochement seulement ; jamais publiées |

Depuis le 2026-10-23, les cellules du classeur alimentent 14 grilles versionnées (écran Tarifs) : pour chaque produit et
variante, une grille « Prix final HELIOSTORES » et une grille « Prix ». Seules les 6 grilles « Prix final » des produits
publiés sont publiées.

## 2. Origine d'une cellule

Chaque montant garde sa référence exacte : fichier › feuille ! cellule (ex. `SB400!F148`), la formule du classeur et sa
valeur en cache, la date d'import, et l'auteur de toute modification (Tarifs → grille → cellule).

| Donnée | Source | Établi ? |
|---|---|---|
| Dimensions | colonnes A (projection, ou hauteur pour screen et véranda) et B (largeur), en cm, converties en mm | oui ; « Projection » lue comme hauteur pour le screen et la véranda : **hypothèse** |
| Colonne C « Prix » | saisie dans le classeur ; « Prix fournisseur » dans les fiches | nature **inconnue** (achat ou prix public du fournisseur) |
| Colonne F « Prix final HELIOSTORES » | formule = « Prix » × trois coefficients (valeur en cache, jamais recalculée) | publiée en € HT par **décision client du 2026-10-21** ; la nature reste à confirmer |
| Devise | aucune dans le classeur ; « DH » dans les fiches | € : **décision client** |
| HT / TTC | aucune mention | HT : **décision client** ; TVA du catalogue (20 %) au panier, taux à confirmer |
| Inclus / suppléments | non précisés (transport, pose, motorisation, LED) | **inconnu** : options, pose et livraison au devis |

## 3. Exemple de lecture (sans montant)

HELIO Horizon, pose murale, projection 4,00 m × largeur 3,00 m :

1. **Source** : feuille `SB400`, bloc « PERGOLA SB400 MURALE », ligne 148 (400 cm × 300 cm).
2. **Source** : `C148` = « Prix » (non publiée) ; `F148` = « Prix final HELIOSTORES », formule `C148 × k₁ × k₂ × k₃`.
3. **Hypothèse / décision** : « murale » correspond à la pose murale du configurateur ; F148 est un prix de vente HT en €.
4. **Règle** : lecture exacte — une cote absente de la grille (ex. 3,60 m de largeur) n'a pas de prix et passe au devis.
5. **Panier** : prix HT + TVA du catalogue ; livraison et pose non comprises.

## 4. Divergences connues

- « Prix final » toujours inférieur à « Prix » : si c'est un prix d'achat remisé, le site vendrait au prix coûtant.
- HELIO Horizon : 10 cellules diffèrent entre la fiche et le classeur (le classeur est appliqué).
- HELIO Panorama : grilles « autoportante / murale » (classeur) ou « premier module / module suivant » (fiche), mêmes montants.
- HELIO Ombra : la grille de la fiche ne correspond à aucune cellule du classeur ; « Projection » lue comme hauteur.
- HELIO Riviera : largeurs minimales par avancée différentes entre la fiche et la documentation technique.
- HELIO Verrière : produit en brouillon, jamais tarifé publiquement.

## 5. Pourquoi d'autres configurations restent sur devis

- cote absente de la grille (aucune interpolation, aucun arrondi non confirmé) ;
- options, pose, livraison : aucun prix validé (les montants évoqués oralement — 150, 200, 250 € — sont indicatifs) ;
- choix à confirmer (teinte hors standard, motorisation, capteurs, niveau Confort des stores) ;
- nouveaux modèles (HELIO Azur) : aucun tarif.

Aucune marge ni commission n'est appliquée : la commission commerciale n'est pas une règle de majoration.

Décisions à obtenir : `decisions-tarifaires.md`.
