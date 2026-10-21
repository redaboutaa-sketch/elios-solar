# Prix publics des systèmes HELIOSTORES

**Décision client du 2026-10-21 :**
- les prix affichés viennent du classeur `SITUATION DES TARIF.xlsx`, colonne **« Prix final HELIOSTORES »** ;
- devise : **euros** ; base fiscale : **HT** ;
- le site ne cite ni le fabricant ni le fournisseur.

Aucun montant n'est versionné dans ce dépôt : les prix sont en base. Ils sont importés depuis le classeur privé (`pnpm supplier-prices:import`), puis publiés.

## Ce qui est affiché

| Page | Affichage |
|---|---|
| Accueil, collections, fiche produit | « À partir de … € HT » : cellule la plus basse de la grille du produit |
| Configurateur | « Prix de la structure … € HT » pour la cote saisie, avec la cellule de grille retenue |
| Devis (compte, PDF, administration), projets | prix de la structure enregistré avec la configuration |

| Panier, commande, confirmation, e-mail | ligne de structure **TTC** (prix HT de la grille + TVA du catalogue, 20 %), « soit … € HT », livraison et pose « non comprises » |

## Commande en ligne (décision client du 2026-10-21)

Une configuration **entièrement tarifée** peut être ajoutée au panier et payée (paiement **simulé** tant que `PAYMENT_PROVIDER=demo`).
Elle l'est si toutes ces conditions sont réunies (`onlineOrderBlockers`, `src/domain/engine.ts`) :
- la cote est couverte par la grille (prix trouvé), sans blocage ;
- la grille a une devise (EUR) et une base fiscale (HT ou TTC) ;
- **aucune option** choisie (le classeur ne les chiffre pas) ;
- **pas de pose professionnelle** demandée ;
- **aucun choix à confirmer** : teinte hors standard, toile ou commande à confirmer, cote au-delà de la limite concordante, fermeture latérale souhaitée, installation en plusieurs modules.

Sinon le configurateur affiche les motifs et propose le devis. Le serveur réévalue chaque ligne à l'ajout, au panier et à la commande : aucun montant ne vient du navigateur.

- **TVA** : un prix HT reçoit la TVA du catalogue (`SiteSettings.defaultTaxRateBps`, 20 % par défaut). Le taux reste à confirmer (question T3).
- **Livraison et pose** : non comprises. Un panier de systèmes n'utilise pas les règles de livraison de l'ancienne démonstration. La commande porte la mention « Livraison et pose non comprises : organisées avec un conseiller après la commande », reprise dans la confirmation, le compte, l'administration et l'e-mail.
- **Délais** : aucun délai n'est affiché ; il est confirmé par un conseiller.
- **Code promotionnel** : masqué pour un panier de systèmes (aucune promotion n'est établie).

Inventaire sur la grille active (préproduction, 2026-10-21), sans option ni pose : toutes les cellules SB400 et SB500 sont commandables. Le REFLEKSOL l'est pour environ 30 % des combinaisons cote × moteur × toile ; les autres ont une largeur au-delà de 4 m ou un choix à confirmer. Le CASABLANCA l'est pour 75 % des combinaisons ; la commande électrique reste à confirmer.

**Points de vigilance avant toute vente réelle :**
- SB500 : la correspondance des deux grilles (« murale/autoportante » ou « premier module/module suivant ») n'est pas confirmée (question T8) ;
- SB400 : 10 cellules diffèrent entre la fiche et le classeur (T7) ; le classeur fait foi ;
- devise, TVA et périmètre du prix (T1 à T4) ne sont pas encore confirmés par le fournisseur.

## Règle de lecture de la grille

- **Pergolas** : la variante suit la pose (murale → « MURALE », autoportante → « AUTOPORTANTE »). La SB500 suit les intitulés du classeur (question T8 de la fiche fournisseur).
- **Arrondi** : la cote saisie est arrondie, sur chaque axe, à la dimension de grille **immédiatement supérieure**. Pour le store banne, la largeur se lit dans des plages : il n'y a pas d'arrondi.
- **Hors grille** : une cote inférieure à la première dimension de la grille ou supérieure à la dernière n'a pas de prix. Le configurateur affiche alors « Prix sur devis pour ces dimensions ». Exemples : SB400 de moins de 1,5 m de largeur ou de moins de 3,4 m de projection ; SB500 de moins de 3 m de projection.
- **Configuration bloquante** (cote hors limites techniques) : aucun prix.
- **Montant** : le montant de la cellule est affiché tel quel, centimes compris.
- **Colonnes non publiées** : la colonne « Prix » (prix source) et les fiches DOCX ne sont jamais publiées. Elles ne sont chargées par aucune page publique, et un test le vérifie.
- **VERANDA FTS** : brouillon, jamais tarifée publiquement.

Code : `src/domain/system-pricing.ts` (lecture de la grille), `src/server/pricing/system-prices.ts` (seul module qui lit les tarifs pour le site).

## Publier, changer, revenir en arrière

```bash
# 1. importer une nouvelle version du classeur (brouillon) — voir import-tarifs.md
pnpm supplier-prices:import --file "<classeur.xlsx>" --apply
# 2. la publier (active la dernière version, fixe devise et base fiscale)
pnpm system-prices:publish --currency EUR --tax HT
# revenir à la version publiée précédente
pnpm supplier-prices:import --rollback xlsx-situation-des-tarif
```

En Docker, ces commandes passent par le service `migrate`, avec le dossier privé monté en lecture seule. Sans version active, ou si la version active n'a pas de devise, aucun prix n'est affiché : tout repasse « sur devis ».

## Sans référence au fabricant ni au fournisseur

Sur le site public :
- pas de marque ni de fabricant sur les fiches ;
- pas de colonne « Source » dans les caractéristiques, ni d'onglet « Points à confirmer » ;
- les sources sont retirées des règles transmises au navigateur ;
- pas de crédit ni de provenance sous les photos ;
- les 14 liens vers les documents du fabricant sont archivés (pas supprimés) ;
- les messages du configurateur ne citent pas de source.

Les valeurs contradictoires restent signalées « à confirmer ». Les sources restent consultables dans l'administration (validation des références, médiathèque). Un test e2e vérifie l'absence des noms dans le texte et dans le code HTML des pages publiques.

**Visuels :** les photographies et rendus restent ceux de la documentation produit. Le pied de page indique « Visuels non contractuels ».
