# HELIOSTORES — migration du catalogue et de l'identité

État au 2026-10-25, branche `feat/heliostores` (draft PR #2, base `feat/storefront-configurator`).

**Itération du 2026-10-25** (`iteration-2026-10-25.md`) : quatre familles (Pergolas, Screens, Stores bannes, Moustiquaires)
et nouvelle nomenclature (Malaga, Marbella, Sevilla ; HelioScreen, HelioRoof Screen ; Casablanca, Corsica, Jamaica,
Madera ; MoskiFold, MoskiFold 2…), visualisation liée à la configuration, navigation latérale, paiements Stripe
(`stripe.md`). Les paragraphes ci-dessous décrivent l'historique des itérations précédentes.

Préproduction : https://demo-elios.beaverdata.eu. Elle est protégée par identifiant, non indexable, avec le paiement en mode test. Les prix de la structure sont affichés selon la grille « Prix final HELIOSTORES » du classeur, en € HT (décision client du 2026-10-21, voir `prix-publics.md`) ; une configuration entièrement tarifée (structure seule, sans option ni point à confirmer) se commande en ligne avec paiement simulé ; le reste passe par un devis. Réalisations et Showroom sont masqués.

Nomenclature commerciale (décision client du 2026-10-22, détail dans `nomenclature.md`) : le site présente HELIO Horizon, HELIO Panorama, HELIO Ombra et HELIO Riviera (HELIO Verrière réservé, en brouillon). Les références fournisseur citées ci-dessous restent internes ; les anciennes URL sont redirigées.

Documents liés :
- `iteration-2026-10-25.md` : demandes de l'itération, statuts, éléments à fournir ;
- `stripe.md` : paiements Stripe (état, raccordement en mode test, bascule réelle) ;
- `nomenclature.md` : noms commerciaux, URL, motorisations, équipements, migration et mentions conservées ;
- `prix-publics.md` : prix affichés (grille, lecture des cotes, publication) et retrait des références fabricant/fournisseur du site ;
- `sources.md` : registre et matrice des sources ;
- `correspondances.md` : ALUPROF, THYSENS, SELT ;
- `medias.md` : registre des médias ;
- `revue-tarifaire.md` : revue tarifaire sans montant ;
- `import-tarifs.md` : procédure d'import privé ;
- `retour-client-2026-10-21.md` : suivi du retour client (accueil, noms, stores, options, guides, réalisations, paiements) ;
- `explication-prix.md` et `decisions-tarifaires.md` : origine des prix et décisions à obtenir ;
- `administration-tarifs.md` : écran Tarifs (grilles versionnées, publication, simulateur, import depuis l'administration) ;
- `identite.md` : charte et logo ;
- `validation-fournisseur.md` : questions au fournisseur (annexe chiffrée privée hors dépôt) ;
- `revue-client.md` : fiche de revue pour le client ;
- `bilan-client.md` : bilan à transmettre au client (sans montant ni nom de fabricant).

> **Le catalogue n'est pas prêt à la vente.** La nature, la devise, la fiscalité et la validité des tarifs transmis ne sont pas établies. Aucun prix n'est affiché et chaque configuration aboutit à une demande de devis.

## 1. Les neuf fichiers transmis (tous lus)

Dossier `/opt/pergola/inputs/heliostores/`. Il est privé, exclu de Git (`/inputs/`) et de Docker (`inputs`). Aucun de ces fichiers n'est publié.

| Fichier | Pages / feuilles | Contenu | Références couvertes | Extraction |
|---|---|---|---|---|
| `PHOTO-2026-10-20-17-17-24.jpg` | 1 image 1230 × 347 | logo HELIOSTORES sur fond noir | — | couleurs mesurées ; variantes web (voir `identite.md`) |
| `Fiche_Technique_PERGOLA_SB400_AVEC_PRIX.docx` | 3 tableaux | spécifications, options, spots, 2 grilles (autonome / murale) | SB400 | texte et tableaux complets ; tarifs importés en privé |
| `Fiche_Technique_PERGOLA_SB500_AVEC_PRIX.docx` | 4 tableaux | spécifications, motorisation, options, poteaux, 2 grilles (premier module / suivant) | SB500 | complète |
| `Fiche_Technique_REFLEKSOL_120_ZIIP.docx` | 2 tableaux | spécifications, 9 moteurs (largeur min., câble), grille | REFLEKSOL 120 ZiiiP | complète |
| `Fiche_Technique_STORE_BANNE_CASABLANCA.docx` | 1 tableau | commande manuelle, supports, couleurs, dimensions, grille | CASABLANCA | complète |
| `Fiche_Technique_VERANDA_FTS.docx` | 1 tableau | commande électrique, toiles, dimensions, options, grille | VERANDA FTS | complète |
| `Catalogue PERGOLA SB400.pdf` | 2 pages | fiche SunBreaker 400 avec filigrane « euro confort » | SB400 | texte et images incorporées, pages vérifiées visuellement |
| `Catalogue THYSENS (7).pdf` | 161 pages | catalogue SELT diffusé par THYSENS et euro-confort : pergolas, vénitiens, screens, vérandas, stores bannes, brise-soleil, coloris, toiles, automatisme | les 5 références et d'autres produits (voir `correspondances.md`) | texte intégral de toutes les pages, toutes les pages rendues ; pages produit examinées visuellement ; images originales extraites ; OCR inutile (calque texte présent) |
| `SITUATION DES TARIF.xlsx` | 5 feuilles visibles, aucune masquée | grilles et formules | SB400, SB500, REFLEKSOL, CASABLANCA, FTS | toutes les cellules, formules et valeurs en cache (voir `revue-tarifaire.md`) |

Les chiffres sensibles ont été contrôlés sur les pages et cellules d'origine : dimensions, pas, sections, classes de vent, coefficients, écarts.

## 2. Identité

Le logo a été examiné et ses couleurs mesurées sur les pixels de cœur, fond noir exclu :
- « HELIO » et le soleil : **`#44664D`** ;
- « STORES » : **`#8AB4A8`** ;
- ® : `#B0B8A6`, à faible confiance.

Les jetons, contrastes et déclinaisons sont dans `identite.md`. Aucun logo vectoriel n'a été inventé et aucune police de marque n'est revendiquée ; les polices du site sont un choix technique. Les couleurs du site ne déterminent pas les teintes RAL des produits.

## 3. Produits

| Nom commercial | Réf. fournisseur (interne) | Famille publique | Statut | Rattachement |
|---|---|---|---|---|
| HELIO Horizon | Pergola SB400 | Pergolas | publié, prix affiché | SB 400 ALUPROF (SELT by Aluprof) |
| HELIO Panorama | Pergola SB500 | Pergolas | publié, prix affiché | SELT ; page ALUPROF absente |
| HELIO Ombra | Screen REFLEKSOL 120 ZiiiP | Screens | publié, prix affiché | R 120 ZiiiP ALUPROF |
| HELIO Riviera | Store banne CASABLANCA | Stores bannes | publié, prix affiché | CASABLANCA AWNING ALUPROF |
| HELIO Verrière (réservé) | Store de véranda VERANDA FTS | aucune | **brouillon** | voir § 4 |

La navigation principale compte exactement trois familles : **Pergolas — Screens — Stores bannes**. Les équipements (LED, spots, poteaux, ensemble solaire, moteurs, automatisme) sont rattachés aux produits compatibles.

**Ancien catalogue de démonstration** (14 familles inspirées de la référence tierce) :
- il est archivé, marqué `legacy` et retiré de la navigation et des parcours ;
- il n'a pas été supprimé, pour garder les références des devis, projets et commandes historiques ;
- il n'est jamais converti en SB400 ou SB500. Un ancien lien affiche un avis et propose de recommencer avec un modèle actuel.
- Les tests d'intégration le réactivent uniquement comme jeu d'essai déclaré du panier, des commandes et du paiement simulé (`SEED_LEGACY_DEMO=active`).

## 4. Classement de VERANDA FTS

La VERANDA FTS est un **store textile de toiture vitrée** (véranda, verrière) :
- pose sur la toiture ou au plafond, deux moteurs à capteurs de charge ;
- jusqu'à 4,5 × 6,5 m selon le catalogue (p. 108–109).

Ce n'est ni une pergola, ni un screen vertical, ni un store banne à bras. Elle reste en **brouillon** : pas de page publique, configurateur fermé. Aucune quatrième famille n'est créée.

**Question au client :** la rattacher aux Stores bannes (protection textile extérieure), en faire un équipement de pergola, ou la laisser hors catalogue ?

## 5. Correspondances

Voir `correspondances.md`. En résumé :
- SB400, REFLEKSOL 120 ZiiiP et CASABLANCA : correspondance **confirmée** ;
- SB500 : **partielle**, aucune page ALUPROF ;
- VERANDA FTS : **à vérifier** ;
- les autres produits du catalogue sont recensés comme « autre produit », non intégrés.

## 6. Données intégrées

- **Techniques** : 78 valeurs sourcées. Chaque ligne indique sa source (fiche client, document fournisseur, site du fabricant) et sa localisation. Les contradictions sont conservées : par exemple la largeur maximale du REFLEKSOL, 4 m selon la fiche et 7 m selon le catalogue et ALUPROF. Détail dans `sources.md`.
- **Configurateurs** : les règles sont générées à partir des mêmes sources (dimensions, pas, combinaisons, poses, teintes, toiles, commandes, inclus, options).
- **Documents** : 14 documents officiels du fabricant sont rattachés aux fiches. Ce sont des liens vers aluprof.com, non ré-hébergés : déclarations des performances, suppléments techniques, notices, brochures. Aucun document de la SB 400 PRO n'est rattaché, et aucun des neuf fichiers du client n'est publié.
- **Tarifs** : ils sont importés en privé, en 6 versions brouillon, non activées et jamais lues par la boutique. **Aucun tarif public n'est intégré** (voir `revue-tarifaire.md`).

## 7. Médias

41 visuels sont publiés, avec la provenance de chaque fichier (page ou URL) dans `medias.md` :

| Produit | Visuels |
|---|---|
| SB400 | 16 |
| SB500 | 3 |
| REFLEKSOL | 9 |
| CASABLANCA | 13 |

Chaque légende indique la nature (photographie fournisseur, rendu ou schéma fabricant) et le crédit. Aucun visuel n'est présenté comme une réalisation HELIOSTORES.

## 8. Configurateurs et 3D

Le configurateur est générique (`/configurateur/<produit>`, `src/domain/system.ts`) et sert les trois types de produits. Les règles appliquées viennent des sources :

**SB400**
- largeur de 1,4 à 4 m ;
- projection de 1,4 à 7 m par pas de 20 cm, soit l'entraxe des lames ;
- hauteur de 2,8 m au plus, minimum non documenté ;
- pose murale ou autoportante ;
- spots dont le nombre dépend des dimensions, selon le tableau de la fiche ;
- cumul LED et spots à confirmer ;
- plusieurs modules : documenté par ALUPROF, composé au devis.

**SB500**
- largeur de 1,4 à 5 m ;
- projection de 2 à 7 m par pas de 25 cm ;
- hauteur de 3,2 m au plus ;
- 3 motorisations documentées ;
- poteaux supplémentaires de 200 à 320 cm ;
- ensemble solaire et paroi SLIDE à confirmer.

**REFLEKSOL 120 ZiiiP**
- au-delà de 4 m de largeur, la configuration est acceptée mais signalée « à confirmer » ;
- largeur minimale imposée par le moteur choisi (9 moteurs) ;
- hauteur de 4 m au plus ;
- pose en niche ou en façade ;
- teintes de la palette SELT et toiles documentées.

**CASABLANCA**
- avancées de 1,6 / 2,1 / 2,6 / 3,1 / 3,6 m ;
- largeur minimale de 2,91 m (avancée 2,6 m) et de 3,51 m (avancées 3,1 et 3,6 m) ;
- pose au mur, au plafond ou sur chevrons ;
- manivelles de 150, 180 ou 220 cm ; version électrique à confirmer.

**Retirés** : les hypothèses de l'ancien store (LED, télécommande, câble, 230 V).

**Fermetures latérales de pergola** : un souhait de screen est accepté, jamais une compatibilité supposée ; il est toujours étudié au devis.

**3D** : elle se construit à partir de la même entrée que le devis.
- *Pergola* : sections du catalogue, lames parallèles au mur à l'entraxe documenté, rotation jusqu'à 120° (SB 400), LED périphérique et spots.
- *Screen* : nouveau constructeur, avec coffre de 126 mm et coulisses ZiiiP en façade ou en niche.
- *Store* : inclinaison comprise entre 5 et 40°, pose sur chevrons, aucune LED ajoutée.

Le repli en plan 2D est conservé pour les pergolas. Pour les screens et les stores, aucune visualisation n'est jointe sans WebGL, et c'est indiqué au client. La visualisation exportée et figée reste jointe au devis et au PDF avec la mention « non contractuelle ».

**Devis** : `priceMode: "quote"` ; récapitulatif sans total ni TVA dans le PDF, le compte client et l'administration.

**Prospects** :
- attribution (paramètres UTM, référent, page d'entrée) jointe aux devis et aux contacts, sans cookie ;
- qualification modifiable en administration.

## 9. Contradictions et informations encore nécessaires

1. **Tarifs** : nature, devise, fiscalité, validité, éléments compris ; version qui fait foi (SB400, REFLEKSOL, FTS) ; sens des grilles SB500. Voir `revue-tarifaire.md`.
2. **REFLEKSOL 120 ZiiiP** :
   - largeur maximale : 4 m selon la fiche, 7 m selon le catalogue et ALUPROF ;
   - hauteur maximale : la page ALUPROF indique 4 m dans ses caractéristiques et « up to 3 m » dans son texte ;
   - toile acrylique citée par la fiche seulement.
   - Un dossier de validation est ouvert dans l'administration.
3. **SB400** : hauteur maximale de 2,8 m sur la page ALUPROF, contre 3 020 mm dans la déclaration P/SB400/25 ; hauteur minimale et pas de largeur non documentés.
4. **SB500** : référence ALUPROF actuelle ; composition de l'ensemble solaire.
5. **CASABLANCA** : moteur de la version électrique ; largeur à partir de laquelle il faut 3 supports.
6. **Compatibilités pergola et screen** : modèles, fixations et ouvertures.
7. **VERANDA FTS** : classement (§ 4).
8. Hors catalogue : identité du vendeur, CGV, transport, pose, comptes de paiement (voir `docs/launch-blockers.md`).

## 10. Vérifications

- Commit déployé : `4bfb76c`, vérifié par `/api/health` (migration `20261021090000_heliostores_catalogue_sources_prices`).
- Typecheck ✅, lint ✅, tests unitaires 194/194, intégration 80/80.
- **Recette navigateur complète contre Docker : 29/29 en une campagne**, bureau et mobile, sans relance.
- CI verte (`verify`, `e2e-docker`).

En CI, les visuels du fabricant, qui sont des fichiers privés, ne sont pas disponibles : la recette y vérifie l'état vide explicite des galeries, annoté dans le rapport.

Le contrôle externe HTTPS a porté sur l'identité, l'absence de montant, les images de toutes les pages, la 3D des trois types, le compte avec cookie sécurisé, et un devis avec visualisation jointe.

## 11. Revue utilisateur

Voir `docs/revue-utilisateur.md` : URL, accès séparés, parcours à tester.
