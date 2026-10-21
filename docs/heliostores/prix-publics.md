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

La commande reste un **devis** :
- pas de panier ni de paiement en ligne ;
- options, pose et livraison sont chiffrées au devis : le classeur ne les contient pas.

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
