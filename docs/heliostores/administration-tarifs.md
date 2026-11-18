# Administration des tarifs (écran « Tarifs »)

> Document publiable : aucun montant, aucun coefficient. Les montants ne se consultent que dans l'écran Tarifs,
> réservé au rôle **administrateur** (les gestionnaires n'y ont pas accès ; chaque page et chaque action le vérifie
> côté serveur).

URL : `/admin/tarifs` (tableau de bord et liste), `/admin/tarifs/grilles/<id>` (éditeur d'une version),
`/admin/tarifs/import` (téléversement), `/admin/tarifs/simulateur`.

## Modèle

Un seul système de versions tarifaires, celui des tarifs fournisseur (`SupplierPriceList` / `SupplierPriceRow`) :

| Portée (`scope`) | Rôle |
|---|---|
| `IMPORT` | trace brute d'un fichier importé (classeur, fiche), dédupliquée par empreinte SHA-256, jamais lue par le site |
| `GRID` | **grille administrée** : un produit × une variante × une colonne d'origine, versionnée (lignée `grid:<produit>:<variante>:<colonne>`) |

Chaque cellule garde sa provenance : fichier, feuille, cellule, formule (valeur en cache, jamais recalculée), date
d'import, et, si elle a été modifiée, l'auteur et la date. Une combinaison absente est « non tarifée » (devis) ; une
cellule vide est « à renseigner » ; un prix nul doit être confirmé explicitement.

Paramètres d'une grille : nature (achat fournisseur, vente, prix conseillé, exemple, non établie), devise ISO, HT ou
TTC, taux de TVA (vide = taux du catalogue), clientèle (toutes, particuliers, professionnels), variantes ou
implantations concernées, validité, éléments inclus et exclus, **règle de lecture des cotes**.

## Cycle de vie

Brouillon → **Vérifier** (contrôles sans blocage) → Vérifiée → **Publier** (immédiatement ou à une date) → En vigueur
/ Programmée → Remplacée, Échue ou **Désactivée**. « Reprendre en brouillon » copie n'importe quelle version.

- Une version publiée n'est jamais modifiée ; toute modification crée une nouvelle version.
- Toute modification d'un brouillon (cellule, paramètre, tarif fixe) annule sa vérification.
- Verrou optimiste : une page restée ouverte pendant une autre modification est refusée (« modifiée entre-temps »).
- Brouillon obsolète : si une autre version de la même grille a été publiée depuis sa création, la publication est
  refusée.
- Pas de chevauchement : publier fixe la fin de validité de la version en vigueur du même contexte (produit,
  variante, nature, clientèle) ; une version programmée plus tard qui recouvrirait la période bloque la publication.
- Désactiver ne réactive aucune ancienne version : le contexte passe au devis.
- Journal (`/admin/journal`) : auteur, date, cellules et paramètres modifiés, publications — **sans montant**.

### Contrôles bloquants avant publication

nature non établie, prix conseillé ou exemple ; devise absente ou invalide ; HT/TTC non établi ; cellule vide ;
prix nul non confirmé ; doublon ; plages de largeur qui se chevauchent ; aucune cellule ; tarif fixe sans montant ;
lecture « dimension supérieure » sans justification ; période incohérente ou échue ; brouillon obsolète ;
chevauchement avec une version programmée.

Avertissements : taux de TVA du catalogue appliqué ; coût d'achat (référence interne, jamais publique) ; produit non
publié ; devise autre que l'euro (commande en ligne fermée) ; grille professionnelle (non utilisée par la boutique).

## Lien avec le site

`src/server/pricing/system-prices.ts` charge, pour la boutique, les grilles **publiées, de nature vente, avec devise
et base fiscale, en vigueur à l'instant**, clientèle « toutes » ou « particuliers » (la plus spécifique l'emporte).
Le moteur commun (`src/domain/system-pricing.ts`, `src/domain/engine.ts`) lit la grille de la variante choisie :

- **lecture exacte** (défaut) : la cote doit être une dimension de la grille ; une largeur peut tomber dans une
  plage (store banne) ; sinon « Prix sur devis », et le configurateur indique les cotes tarifées ;
- **dimension supérieure** : seulement si la grille porte cette règle avec sa justification (qui l'a confirmée) ;
- aucune interpolation ; la TVA de la grille (ou du catalogue) est ajoutée à un prix HT au panier.

Un tarif ne rend ni un produit visible (un produit en brouillon reste hors catalogue), ni une configuration
commandable : compatibilités, choix à confirmer, options et pose suivent les règles existantes. Les devis et commandes
émis gardent leur instantané ; un projet modifié est réévalué.

Coûts d'achat, brouillons et colonnes non publiées ne sont jamais chargés par une page publique, l'instantané du
configurateur, un PDF client ou un e-mail (tests d'intégration).

## Import

`/admin/tarifs/import` : Téléverser (.xlsx, .docx, 8 Mo au total) → Analyser → Prévisualiser (produits et
variantes reconnus, grilles et unités, montants interprétés, cellules inexploitables, changements par rapport aux
grilles existantes, informations empêchant une publication) → Corriger les correspondances (produit, variante, axe ;
nature, devise, HT/TTC par colonne) → Importer.

- Les fichiers sont gardés en base le temps de l'analyse puis effacés ; ils ne passent ni par `public/`, ni par la
  médiathèque.
- Un fichier déjà importé (même empreinte, quel que soit son nom) réutilise sa version ; une grille dont les cellules
  n'ont pas changé ne reçoit pas de nouveau brouillon.
- L'import crée uniquement des **brouillons** ; il ne modifie aucune version existante (un brouillon retouché à la
  main reste intact) et ne publie rien.

En ligne de commande : `pnpm supplier-prices:import --file … [--apply]` (voir `import-tarifs.md`) ; `--apply` crée
aussi les brouillons de grille, de nature non établie. `pnpm tariffs:init` (appelé par le seed) initialise les grilles
depuis l'import existant du classeur, une seule fois.

## Recalcul depuis une grille de base

Sur une grille, « Recalculer depuis une grille de base » crée un brouillon à partir d'une autre grille du même
produit et de la même variante, selon une règle saisie par l'administrateur (aucune valeur proposée) :

| Règle | Formule |
|---|---|
| Coefficient | prix = base × k |
| Majoration sur coût d'achat | prix = coût × (1 + m %) |
| Marge sur prix de vente (taux de marque) | prix = coût ÷ (1 − t %) |

Arrondi au centime, au demi supérieur, calcul exact en entiers. La règle est écrite dans la version. La formule du
classeur (« Prix final » = « Prix » × trois coefficients) est affichée comme **observation**, pas comme règle validée.
La commission commerciale n'est pas une règle de majoration.

## Simulateur

`/admin/tarifs/simulateur` : produit, pose, cotes, clientèle, date, et éventuellement une version précise (brouillon
compris). Il affiche la version utilisée, la cellule retenue, le prix HT, la TVA et le TTC, puis l'évaluation par le
moteur de la boutique (commande en ligne possible ou motifs du devis).

## Procédure : modifier un prix et le publier

1. Tarifs → filtrer le produit → ouvrir la version **en vigueur**.
2. « Modifier (nouveau brouillon) ».
3. Saisir le montant dans la cellule (ou sélectionner plusieurs cellules : valeur, variation en %, vider, retirer),
   puis « Enregistrer ».
4. Vérifier la comparaison avec la version publiée et, si besoin, le simulateur (version brouillon).
5. « Vérifier la grille » ; corriger les blocages éventuels.
6. « Publier » immédiatement ou à une date. La version précédente reçoit sa fin de validité.
