# Import privé des tarifs fournisseur (HELIOSTORES)

> Document publiable : il ne contient **aucun montant, aucun coefficient, aucune ligne** des fichiers
> du client. Les sources restent hors dépôt (`/opt/pergola/inputs/heliostores/`, ignoré par Git et par
> Docker) et les résultats d'analyse détaillés uniquement dans `/opt/pergola/private/` (ignoré par Git).

## Principe

- Les tarifs transmis (classeur `.xlsx`, fiches techniques `.docx` « avec prix ») sont importés dans
  les tables `SupplierPriceList` (une **version** par fichier et par empreinte) et `SupplierPriceRow`
  (une ligne par cellule de montant, avec sa référence exacte).
- Ces données sont **internes** : elles ne sont lues ni par le catalogue public, ni par l'instantané du
  configurateur, ni par le calcul des prix, ni par les pages publiques (test d'intégration dédié).
- Tant que la nature des colonnes n'est pas établie par écrit, chaque version est importée avec
  `nature = UNKNOWN` et `taxBasis = UNKNOWN`. Aucune marge n'est déduite, aucune devise n'est convertie.
- Devise : retenue seulement si la source l'écrit (« DH » → `MAD`, « € » → `EUR`) ; sinon `null`, avec
  une note (`currencyNote`) qui dit où la devise a été lue — ou qu'elle ne l'a été nulle part.

## Ce qui est lu

### Classeur XLSX (exceljs)

- Toutes les feuilles ; la structure de l'archive est contrôlée : feuilles masquées, liens externes
  (jamais suivis), commentaires, noms définis (les noms intégrés type zone d'impression sont comptés à part).
- Dans chaque feuille : titre fusionné en tête, puis des **blocs** (ligne de titre, ex. « … AUTOPORTANTE »
  / « … MURALE », puis ligne d'en-tête `Projection (cm) | Largeur (cm) | Prix | Surface m2 | Prix/m2 | Prix final …`).
- La famille est déduite du nom de feuille / titre (`pergola-sb400`, `pergola-sb500`,
  `screen-refleksol-120-ziiip`, `store-banne-casablanca`, `veranda-fts`) ; la variante du titre de bloc
  (`autoportante`, `murale`, `premier-module`, `module-suivant`, ou vide).
- Dimensions converties en mm (cm × 10). Une largeur en **bande** (« 200-290 ») donne `widthMinMm` / `widthMaxMm`.
- Nombres stockés en texte : convertis et comptés (`conditions.dimAStoredAsText`).
- Formules : on conserve la **formule** et la **valeur en cache** ; rien n'est jamais recalculé.
  Colonne « Prix » et colonne « Prix final » donnent deux lignes distinctes (`amountRole` = `PRIX_SOURCE` / `PRIX_FINAL`).
- Pour les stores verticaux (screen, véranda), la colonne intitulée « Projection » est interprétée comme
  une **hauteur** : l'interprétation est écrite dans chaque ligne (anomalie « à vérifier ») et dans le rapport.

### Fiches DOCX (archive zip, `word/document.xml`)

- Tableaux de grille (`Projection|Hauteur`, `Largeur`, `Prix fournisseur (…)`, `Prix final … (…)`), la
  variante étant lue dans le paragraphe qui précède (ex. « Autonome », « Murale », « Premier module »).
- Tableaux d'options (spots par plages de projection / largeur, poteaux par longueur, moteurs avec
  longueur de câble et largeur minimale du système) → lignes `OPTION`, plages dans `conditions.match`.
- Lignes de texte chiffrées (« … : <montant> € », « +<montant> DH par … ») → lignes `OPTION`, avec la
  phrase source (`conditions.sourceText`), « non remisé », « la première est incluse »…

## Contrôles et statuts

| Contrôle | Effet |
| --- | --- |
| Cellule vide ou non numérique | montant `null` (jamais 0), ligne `TO_CHECK` |
| Formule sans valeur en cache | montant `null`, ligne `TO_CHECK` (pas de recalcul) |
| « Prix final » ≠ « Prix » × coefficient lu dans sa formule | `TO_CHECK` |
| Coefficient différent du reste de la feuille / rapport différent du reste du tableau | `TO_CHECK` |
| « Prix final » sans formule | `TO_CHECK` |
| Surface / prix au m² incohérents | `TO_CHECK` |
| Doublon (même famille, variante, dimensions, colonne) | `TO_CHECK` sur chaque ligne du groupe |
| Combinaison manquante dans le rectangle couvert (grille incomplète) | listée dans le rapport, **jamais complétée** |
| Écart fiche ↔ classeur (montant, combinaison absente, libellé de variante, intitulé de dimension, aucune cellule commune) | rapport + `TO_CHECK` sur les lignes concernées |
| Famille non reconnue | `REJECTED` |

Statuts d'une ligne : `OK` (lue sans anomalie — ce n'est pas une validation commerciale), `TO_CHECK`, `REJECTED`.

Statuts d'une version : `DRAFT` (importée, en revue) → `ACTIVE` (une seule par source ; l'activation archive
l'ancienne) → `ARCHIVED` ; `REJECTED` (conservée, jamais activable). Le **retour arrière** réactive la
dernière version archivée qui avait été active. Chaque import / activation / retour arrière / rejet est
inscrit dans le journal d'audit (comptes et empreintes uniquement, aucun montant).

Le rapprochement fiche ↔ classeur n'a lieu qu'entre fichiers passés **dans le même lancement** : passer
le classeur et toutes les fiches ensemble.

## Lancer l'import

Le script n'imprime **jamais** de montant ni de coefficient (« montants masqués ») : uniquement des comptes,
des références de cellules et des messages de contrôle.

```bash
# Aperçu (par défaut, aucune écriture)
pnpm supplier-prices:import --file "/chemin/prive/classeur.xlsx" --file "/chemin/prive/fiche.docx"

# Création d'une nouvelle version en brouillon (DRAFT) par fichier ; empreinte identique = sans effet
pnpm supplier-prices:import --file … --file … --apply

# Création puis activation (à réserver aux versions revues)
pnpm supplier-prices:import --file … --apply --activate

# Retour arrière sur une source
pnpm supplier-prices:import --rollback <sourceKey>
```

Options : `--source-key <clé>` (un seul fichier) impose la clé de source ; sinon elle est dérivée du nom de
fichier (`xlsx-…`, `docx-…`).

Codes de sortie : `0` succès · `1` erreur inattendue · `2` usage · `3` fichier illisible ou non pris en
charge · `4` source sans aucune ligne reconnue · `5` activation / retour arrière refusé.

### En production (Docker)

Le dossier privé est monté **en lecture seule** dans le conteneur outils ; il n'est jamais copié dans
l'image (`.dockerignore`).

```bash
docker compose -f docker/compose.prod.yml --env-file .env.prod run --rm \
  -v /opt/pergola/inputs/heliostores:/inputs:ro \
  migrate pnpm supplier-prices:import \
  --file "/inputs/<classeur>.xlsx" --file "/inputs/<fiche>.docx"
# puis la même commande avec --apply
```

## Revue dans l'administration

`/admin/catalogue/tarifs-fournisseur` — **administrateurs uniquement** (les gestionnaires n'y ont pas accès) :

- liste des versions par source : statut, fichier, préfixe d'empreinte, badges nature / HT-TTC / devise,
  comptes OK / à vérifier / rejetées, boutons Activer, Rejeter, Revenir à la version précédente ;
- détail d'une version : feuilles et tableaux analysés, formules, écarts fiche ↔ classeur, combinaisons
  manquantes, doublons, et le tableau des lignes filtrable (famille, variante, colonne, statut).
  C'est le **seul** endroit où les montants sont affichés, sous un bandeau permanent
  « Montants internes — nature non établie, jamais publiés ».

Aucun téléversement depuis l'administration : les fichiers ne transitent jamais par `public/` ni par la
médiathèque servie aux visiteurs.

## Confidentialité (dépôt public)

- Ne jamais committer : fichiers sources, extraits, captures, rapports chiffrés, coefficients.
- Les tests utilisent des fichiers **synthétiques** générés pendant le test, avec des montants inventés.
- Le rapport détaillé (montants compris) est écrit hors dépôt, dans `/opt/pergola/private/heliostores/prices/`.
