# Tarifs fondés sur les catalogues SELT — import et validation

> Document publiable : aucun montant, aucun coefficient, aucune remise. État au 2026-10-31 : **aucun catalogue SELT
> reçu**, aucun accès au portail ; le processus et l'administration sont prêts, aucun prix n'est publié.

## 1. Principe

- Source de référence : catalogues fournis par le client depuis le portail `b2b.selt.com` (accès en cours
  d'obtention). Le site n'accède jamais au portail et n'en dépend pas : les fichiers sont déposés à la main.
- Un seul système de tarifs : l'administration existante (Administration → Tarifs, `docs/heliostores/administration-tarifs.md`).
  Le format normalisé ci-dessous n'est qu'un **lecteur** de plus pour l'écran d'import.
- Objectif commercial : **afficher les prix** sur les fiches et dans le configurateur dès qu'une grille de vente est
  validée. « Sur devis » reste le repli pour une donnée manquante ou une configuration hors grille. L'encaissement en
  ligne est une décision distincte (non modifiée).
- Les tarifs de l'ancien classeur (« SITUATION DES TARIF », source `xlsx-situation-des-tarif`) restent dans
  l'historique : ils ne sont ni assimilés aux catalogues SELT, ni transférés.

## 2. Répertoire privé

`inputs/heliostores/selt-pricing/` (hors Git et hors Docker, `README.md` sur place) :

| Dossier | Contenu |
|---|---|
| `recus/` | fichiers d'origine, intacts, avec `SHA256SUMS` |
| `normalises/` | reports au format normalisé (un fichier par catalogue et par nature) |
| `decisions/` | décisions écrites et datées du client |

## 3. Processus

1. **Import** — Administration → Tarifs → Importer : téléverser le fichier normalisé (.csv UTF-8 ou .xlsx dont la
   première feuille porte les en-têtes). Aperçu sans écriture : lignes reconnues, unités converties, montants lus,
   lignes rejetées avec leur motif, doublons, trous de grille, comparaison avec la version précédente de chaque grille.
2. **Contrôle** — erreurs explicites par ligne (colonne vide, unité, cote hors plage plausible 200–20 000 mm, montant
   illisible ou nul, devise, HT/TTC, nature, dates, remise hors catalogue fournisseur) ; devises ou bases mélangées
   signalées, **aucune conversion**. Les messages ne citent jamais de montant.
3. **Rapprochement produit** — par la colonne `produit` (identifiant stable, ex. `marbella`) ou, à défaut, par la
   référence fournisseur via la transcodification validée (`src/server/catalog/name-transco.ts`, ex. `SB450` →
   HelioMax). Une référence inconnue devient un groupe « non rapproché » à affecter dans l'écran d'import ; sans
   affectation, la grille ne peut pas être publiée (produit inconnu).
4. **Import idempotent** — une version brute (trace, jamais publiée) par fichier ; même empreinte SHA-256 = rien de
   nouveau. Puis un **brouillon** de grille par produit × variante × nature ; cellules identiques à la dernière
   version = aucun doublon.
5. **Simulation** — Administration → Tarifs → Simulateur : le moteur réel calcule une configuration avec la grille.
6. **Validation administrateur** — compléter les paramètres (nature, devise, HT/TTC, TVA, clientèle, lecture des
   cotes, période, inclus/exclus), « Vérifier » (contrôles bloquants), puis « Publier » (immédiat ou programmé).
   Auteur et date sont enregistrés ; le journal ne contient aucun montant.
7. **Activation et retour arrière** — seule une grille de **vente** publiée, en vigueur, en devise et base établies
   alimente le site. Retour : désactiver la version (le site repasse « sur devis » pour ces configurations, sans
   reprise implicite), puis « Reprendre en brouillon » une version antérieure, la vérifier et la publier.
   La publication et la désactivation vident les caches (catalogue, aide immédiate du chat).

## 4. Natures de prix — toujours distinctes

| Nature (administration) | Rôle dans le fichier | Usage |
|---|---|---|
| Prix catalogue fournisseur (`SUPPLIER_LIST`) | `catalogue_fournisseur` | référence interne ; ni achat, ni vente |
| Achat fournisseur (`PURCHASE`) | `achat_net` | coût interne, jamais affiché |
| Vente (`SALE`) | `vente` | seul prix public possible, après validation |

Règles explicites, saisies par l'administrateur et enregistrées avec la version (Tarifs → grille → Recalcul) :
- **remise fournisseur** : achat net = prix catalogue × (1 − r %) — base « prix catalogue fournisseur », cible
  « achat fournisseur » obligatoires ;
- **coefficient** : prix = base × k ;
- **majoration sur coût** : prix = coût × (1 + m %) ; **marge sur prix de vente** : prix = coût ÷ (1 − t %)
  (25 % de majoration ≠ 25 % de marge) — base « achat fournisseur » obligatoire.
Arrondi : au centime, demi supérieur, une fois par cellule (calcul exact en entiers). Montants en centimes.
Aucune règle n'a de valeur par défaut ; la commission commerciale de 3 % n'est jamais ajoutée au prix client.
TVA : taux de la grille ou du catalogue ; livraison et pose : hors grille, chiffrées au devis tant qu'aucune règle
n'est fournie.

## 5. Publication des prix

- Grille de vente validée : le configurateur calcule le prix de la configuration (calcul serveur ; un montant envoyé
  par le navigateur est ignoré) et l'affiche avec sa base (HT/TTC) et son périmètre (structure seule, inclus).
- Donnée absente ou configuration hors grille : « sur devis » pour cette configuration seulement.
- Jamais de prix nul ou fictif, jamais d'interpolation (lecture exacte des cotes, sauf règle d'arrondi confirmée),
  jamais de « à partir de » sans cellule réellement chiffrée, jamais de prix d'achat, remise ou marge en public.
- Les devis émis gardent leur prix et leur version (instantané figé).

## 6. Format normalisé

Modèle d'en-têtes : `docs/pricing/selt-normalise-modele.csv` (aucune donnée). Séparateur « ; » (ou « , »), UTF-8,
une ligne par prix. En-têtes insensibles à la casse et aux accents ; colonnes inconnues ignorées (signalées).

| Colonne | Obligatoire | Contenu |
|---|---|---|
| `ref_fournisseur` | oui | référence du produit chez le fournisseur (privée) |
| `produit` | non | identifiant stable HELIOSTORES (slug) ; sinon rapprochement par la référence |
| `variante` | non | ex. `murale`, `autoportante`, `premier-module` |
| `type_ligne` | oui | `grille`, `option` ou `fixe` |
| `code` | option | code de l'option ou du supplément |
| `libelle` | oui | libellé de la ligne dans le catalogue |
| `dimension_a` | grille | `projection` (défaut) ou `hauteur` |
| `unite` | grille | unité des cotes : `mm`, `cm` ou `m` |
| `dim_a`, `largeur_min`, `largeur_max` | grille | cotes (largeur_min = largeur_max pour un point) |
| `montant` | oui | décimal, deux décimales au plus (« 1 234,56 ») ; vide si absent, jamais 0 |
| `devise` | oui | code ISO (EUR…) |
| `base` | oui | `HT` ou `TTC` |
| `nature` | oui | `catalogue_fournisseur`, `achat_net` ou `vente` |
| `remise_fournisseur_pct` | non | remise portée par le catalogue (prix catalogue seulement) |
| `inclus` | non | équipements inclus selon le catalogue |
| `regle` | non | règle d'application écrite dans le catalogue |
| `source_document` | oui | document d'origine (nom et édition) |
| `source_localisation` | oui | page, tableau, ligne ou cellule |
| `valide_du`, `valide_au` | non | période de validité (JJ/MM/AAAA ou AAAA-MM-JJ) |

Conservé pour chaque version : fichier, empreinte, date d'import, auteur, devise, HT/TTC, nature, période, référence
fournisseur et localisation par ligne, inclus et règles, statut, vérification et publication (auteur, date),
historique des versions et journal.

Les lecteurs sont à adapter aux fichiers **réellement reçus** : si un catalogue arrive en XLSX structuré, un lecteur
dédié pourra remplacer le report manuel ; aucun extracteur n'est écrit pour un format non vu.

## 7. Attendu du client (registre de lancement : `selt-catalogues`, `selt-regles-commerciales`)

1. Les catalogues ou exports tarifaires d'origine, déposés dans `recus/`.
2. Pour chaque catalogue : nature des montants (catalogue ou achat net), devise, HT/TTC, période de validité.
3. Remise fournisseur éventuelle et règle de vente (coefficient, majoration ou marge) — décision écrite et datée.
4. Éléments inclus, options et suppléments, livraison et pose (ou confirmation qu'ils restent au devis).
5. Lecture des cotes entre deux valeurs (exacte, ou arrondi supérieur confirmé par le fournisseur).

## 8. Tests

`tests/unit/supplier-prices-normalized.test.ts` (lecture, unités, erreurs sans montant, rapprochement, devises
mélangées, remise et arrondis, majoration ≠ marge) ; `tests/integration/selt-pricing.test.ts` (aperçu sans écriture,
import idempotent, prix catalogue et achat jamais publics, remise → achat net → vente, publication, désactivation sans
reprise implicite, retour à la version précédente, montant du navigateur ignoré) ; existants :
`tests/integration/tariffs.test.ts`, `supplier-prices.test.ts`.
