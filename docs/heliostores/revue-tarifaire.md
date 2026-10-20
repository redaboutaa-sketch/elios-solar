# Revue tarifaire (version publiable — aucun montant, aucun coefficient)

Le détail complet (montants, coefficients, cellules) se trouve dans `private/heliostores/prices/import-report.md`, hors dépôt. Les versions importées sont consultables par les administrateurs dans **Administration → Catalogue → Tarifs fournisseur** (statut brouillon, aucune version activée). Procédure d'import : `import-tarifs.md`.

## Sources analysées

| Fichier | Contenu tarifaire | Devise indiquée | HT / TTC |
|---|---|---|---|
| `SITUATION DES TARIF.xlsx` (5 feuilles : SB500, SB400, REFLEKSOL 120 ZIP, STORE BANNE CASA, VERANDA FTS) | grilles projection (ou hauteur) × largeur, colonnes « Prix », « Surface m2 », « Prix/m2 », « Prix final HELIOSTORES » (formules) | **aucune** | **non indiqué** |
| Fiche SB400 « AVEC_PRIX » | 2 grilles (autonome / murale) ; options LED et spots ; révision moteur | DH (grilles), € (options « non remisées ») | non indiqué |
| Fiche SB500 « AVEC_PRIX » | 2 grilles (« premier module » / « module suivant ») ; spots, LED, ensemble solaire, poteaux | DH, € | non indiqué |
| Fiche REFLEKSOL 120 ZIIP | 1 grille hauteur × largeur ; plus-values moteurs | DH, € | non indiqué |
| Fiche CASABLANCA | 1 grille avancée × bandes de largeur | DH | non indiqué |
| Fiche VERANDA FTS | 1 grille hauteur × largeur | DH | non indiqué |

Constats sur le classeur :
- il ne contient ni feuille masquée, ni lien externe, ni commentaire ;
- toutes les formules ont une valeur en cache et aucune n'a été recalculée ;
- des dimensions saisies comme texte ont été converties et signalées : SB400 murale, colonne A, 54 cellules ; REFLEKSOL, 108 cellules ;
- une cellule vide n'est jamais traduite en prix nul.

## Nature des montants : **non établie**

- La mention « AVEC_PRIX » dans un nom de fichier ne dit pas de quel prix il s'agit.
- Le « Prix final HELIOSTORES » est **toujours inférieur** au « Prix fournisseur ». Dans le classeur, il est calculé par une formule propre à chaque produit, appliquée au montant « Prix ».
- Aucune source ne dit s'il s'agit d'un prix d'achat, d'un prix public conseillé ou d'un prix de vente. Aucune ne précise la devise du classeur, la fiscalité, la validité, ni ce qui est compris : transport, pose, motorisation.
- La commission commerciale évoquée dans le partenariat n'est pas une règle de majoration. Aucune marge n'est calculée.

**Conséquence :** aucun prix n'est publié. Tous les produits sont « prix sur devis » ; les montants restent internes, consultables par les administrateurs.

## Contradictions entre sources (catégories)

| Catégorie | Constat | Bloque |
|---|---|---|
| Montants différents (SB400) | 10 cellules diffèrent entre la fiche et le classeur, dont toute la ligne murale à 520 cm de projection | prix SB400 |
| Grille sans correspondance (REFLEKSOL, FTS) | Les grilles des fiches ne correspondent à aucune cellule du classeur, croissent de façon parfaitement linéaire et couvrent moins de dimensions | prix REFLEKSOL / FTS |
| Libellé de variante (SB500) | Fiche : « Premier module » / « Module suivant ». Classeur : « AUTOPORTANTE » / « MURALE ». Les montants sont identiques | prix SB500 |
| Libellé de dimension | Classeur : « Projection ». Fiche : « Hauteur » (REFLEKSOL, FTS) | interprétation des grilles |
| Couverture | SB500 : la fiche annonce 2 m de projection minimale (pas de 25 cm) et 1,4 m de largeur, mais la grille commence à 3 m (pas de 50 cm) et 2,5 m. REFLEKSOL : le classeur va jusqu'à 7 m de largeur alors que la fiche indique 4 m | petites dimensions, grandes largeurs |
| Grilles incomplètes | CASABLANCA et FTS ont une couverture « triangulaire » : les grandes avancées ou hauteurs ne sont pas proposées pour les petites largeurs. Les combinaisons absentes ne sont pas complétées | — (utilisé pour les règles CASABLANCA : largeur minimale par avancée, concordante avec la fiche) |

## Données à obtenir pour publier un prix

1. Pour chaque colonne : prix d'achat net, prix public conseillé ou prix de vente.
2. La devise (DH ou €) et la fiscalité (HT ou TTC, taux applicable).
3. La date et la validité du tarif, ainsi que les remises et conditions.
4. Ce qui est compris : transport, pose, motorisation, LED « non remisée ».
5. La version qui fait foi entre fiche et classeur : SB400 (10 cellules), REFLEKSOL et FTS (grilles).
6. Le sens des deux grilles SB500 : premier module et extension, ou autoportante et murale.
7. Le pays de vente et la règle de prix public à appliquer, s'il y en a une.

Tant que ces points ne sont pas réglés, le configurateur conserve le calcul serveur autoritaire et maintient la demande de devis.
