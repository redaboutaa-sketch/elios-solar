# QA visuelle — refonte HELIOSTORES

Date : 2026-10-21. Revue faite dans Chromium (Playwright 1.64) sur le serveur de dev et sur la préproduction réelle (médias
importés, grille de prix active). Les captures restent hors du dépôt, comme toutes les captures du projet.

## Passes réalisées

| Passe | Contrôle | Résultat |
|---|---|---|
| Structure et hiérarchie | captures pleine page 390 / 1440 px de 10 pages, avant / après | ✅ sélecteur à dessins dans le premier écran (1440 px : entier ; 390 px : commence à ~610 px) |
| Typographie, couleurs, médias | Manrope / Inter, vert #44664D en action, sauge en aplat uniquement | ✅ ; rendus sur fond blanc en `contain`, photos en `cover` |
| Détails et interactions | méga-menu, survol et focus des dessins, galerie, onglets, choix en tuiles | ✅ (captures d'état) |
| Mobile et tablette | 320, 360, 390, 720, 768, 1024, 1440 px, 13 pages | ✅ 0 défilement horizontal (`scrollWidth − innerWidth`) |
| Zoom | 200 % ≈ 720 px CSS, 400 % ≈ 320 px CSS | ✅ réagencement sans perte ni débordement |
| Parcours de conversion | e2e : catalogue, configurateurs SB400 / SB500 / REFLEKSOL / CASABLANCA, devis, commande, chat, médias | ✅ dev : 32/33, puis 9/9 sur les specs 02 et 08 après le correctif TR-DES-010 ; HTTPS sur la préproduction : 6/6 (specs 01 et 08) |
| Accessibilité | axe-core 4.10 (WCAG 2.0/2.1/2.2 A et AA), 13 pages × 390 / 1440 px | ✅ 0 violation |
| Clavier | ordre de tabulation, lien d'évitement, sous-menus, Échap du menu mobile, retour du focus | ✅ |
| Réduction des animations | `reducedMotion: reduce` : dessins statiques, pas de glissement | ✅ |

## Anomalies trouvées et corrigées

| ID | Reproduction | Cause | Correctif | Vérification |
|---|---|---|---|---|
| TR-DES-010 | e2e mobile SB400 : « Projet enregistré » absent après « Sauvegarder » | la barre de prix mobile, masquée pendant la saisie, réapparaissait au `mousedown` (perte de focus du champ) et recevait le `mouseup` : clic perdu | réapparition différée de 400 ms (`visibility`) | spec 02 + 08 : 9/9 |
| TR-DES-011 | repères d'étapes du configurateur collés sous l'en-tête en préproduction | hauteur d'en-tête fixe supposée (sans le bandeau « Préproduction ») | variable `--header-h` selon la présence du bandeau | capture mobile |
| TR-DES-012 | sous-menus inaccessibles à la tabulation | `visibility` animée : encore masquée au moment du Tab | transition limitée à l'opacité et au déplacement | ordre de tabulation relevé |
| TR-DES-013 | en-tête à 1024 px : libellés et CTA sur deux lignes | largeur insuffisante | `nowrap`, CTA court « Configurer » sous 1280 px, logo réduit | capture 1024 px |
| TR-DES-014 | sections quasi invisibles en capture pleine page | fondu lié au défilement (`view()`) avant l'entrée dans la fenêtre | glissement seul, sans opacité ; désactivé à l'impression | captures pleine page |
| TR-DES-015 | document HTML de l'accueil plus lourd | dessins SVG en ligne avec deux états d'animation, répétés dans le méga-menu | dessins statiques dans les menus, coordonnées arrondies | mesure ci-dessous |
| TR-DES-016 | bouton de chat au-dessus du menu mobile ouvert | ordre d'empilement | bouton masqué pendant l'ouverture du menu | capture du menu |

## Mesures de laboratoire (avant / après)

Préproduction, Chromium sans bridage réseau ni processeur, 390 × 844, cache vide, médiane de 3 chargements. Ce sont des
mesures de laboratoire, pas des données d'utilisateurs réels (aucune mesure terrain n'est collectée). Octets non compressés
tels que reçus par le navigateur.

| Page | LCP | CLS | JS | CSS | Polices | Images | Document |
|---|---|---|---|---|---|---|---|
| `/` avant | 192 ms | 0 | 490 Ko | 51 Ko | 79 Ko | 288 Ko | 57 Ko |
| `/` après | 168 ms | 0 | 496 Ko | 65 Ko | 71 Ko | 290 Ko | 174 Ko (25 Ko en gzip, HTTPS) |
| `/pergolas` avant | 164 ms | 0,021 | 490 Ko | 51 Ko | 79 Ko | 137 Ko | 45 Ko |
| `/pergolas` après | 120 ms | 0 | 496 Ko | 65 Ko | 71 Ko | 137 Ko | 123 Ko |
| fiche SB400 avant | 192 ms | 0 | 492 Ko | 51 Ko | 79 Ko | 328 Ko | 98 Ko |
| fiche SB400 après | 152 ms | 0 | 499 Ko | 65 Ko | 71 Ko | 328 Ko | 159 Ko |
| configurateur SB400 avant | 152 ms | 0 | 580 Ko | 51 Ko | 79 Ko | 111 Ko | 412 Ko |
| configurateur SB400 après | 156 ms | 0 | 590 Ko | 65 Ko | 71 Ko | 111 Ko | 463 Ko |

Lecture : aucune bibliothèque ajoutée (+6 à +10 Ko de JS : menu mobile, repères d'étapes) ; polices plus légères ; images
servies avec la variante 640 px en `srcset` (les visuels de l'accueil sous la ligne de flottaison sont chargés en différé) ;
le document grossit à cause des dessins SVG en ligne et des sections ajoutées, mais reste à 25 Ko compressé pour l'accueil.
La 3D reste chargée à la demande (bouton « Vue 3D »), jamais sur l'accueil.

## Limites et points à examiner

- Le morphing des dessins (`d`) n'est pas pris en charge par Safari : le dessin y reste statique (le lien fonctionne).
- Les mesures sont de laboratoire, sans réseau mobile simulé.
- Vérifié dans Chromium uniquement (Firefox et Safari non disponibles sur le VPS).
- La police du logo n'étant pas fournie, Manrope et Inter restent des choix d'interface, réversibles.

## Itération 2 — composition « catalogue fabricant » (commit déployé 0d16dc4)

| Contrôle | Résultat |
|---|---|
| Débordement horizontal, 13 pages × 360 / 390 / 768 / 1024 / 1440 px | ✅ 0 |
| axe-core (WCAG 2.2 A/AA), 15 pages × 390 / 1440 px (dont `/guides`, fiche CASABLANCA) | ✅ 0 violation |
| Panneaux « Nos solutions » à 1440 px | ✅ 467/467/467 px au repos ; 350/700/350 au survol ; idem au focus clavier ; empilés sur mobile, CTA visible |
| Grand visuel | ✅ 3 vues, commandes visibles, flèches du clavier, aucune lecture automatique, vues 2–3 chargées à l'affichage |
| Menu mobile | ✅ Échap, croix et bouton Retour du navigateur le ferment (URL inchangée), focus rendu au bouton |
| Galerie de fiche | ✅ SB400 : Photos et rendus / Vue 3D / Dessins techniques ; SB500 : 2 modes (aucun dessin publié) ; `<dialog>` : focus sur « Fermer », Échap rend le focus à « Agrandir » ; 3D sans erreur |
| Aperçu 3D de l'accueil | ✅ canevas affiché au clic ; three.js absent du chargement initial |
| e2e dev | 31/33 puis 5/5 (specs 01 et 07) après le correctif TR-DES-030 ; 08 inclus dans la campagne complète |
| e2e HTTPS préproduction | ✅ 01 et 08 : 6/6 ; 07 non exécutable en HTTPS direct (session administrateur absente avec `--no-deps`), validée en dev |
| Médias publics (préproduction) | ✅ « Médias conformes » (contrôle adapté aux modes de galerie, TR-DES-031) |
| Préproduction | ✅ 17 pages en 200, Réalisations / Showroom / VERANDA FTS en 404, 401 sans identifiants, noindex, paiement démo, 0 mention fabricant / fournisseur / provenance |

| ID | Anomalie | Cause | Correctif |
|---|---|---|---|
| TR-DES-030 | e2e 01 : noms de fichiers sources et URL du fabricant dans le code de l'accueil | l'objet média complet (provenance comprise) était passé au composant client du grand visuel, donc sérialisé | seuls chemin, texte alternatif et dimensions sont transmis ; contrôle sur 16 pages : 0 occurrence de « provenance » ou « sha256 » |
| TR-DES-031 | contrôle des médias : visuels « absents », 2 images « cassées » | le script ne lisait que le mode par défaut de la galerie ; images différées d'onglets masqués comptées | parcours de chaque mode ; seules les images affichées sont contrôlées |
| TR-DES-032 | ligne visible sous l'en-tête superposé | dégradé de l'en-tête ajouté au voile du visuel | en-tête transparent, voile unique |
| TR-DES-033 | débordement de 129 px à 390 px | largeur intrinsèque des rendus dans une grille sans `min-w-0` | image positionnée en absolu dans un cadre à ratio fixe |
| TR-DES-034 | commandes du carrousel sous le bouton de chat (mobile) | alignement à droite | commandes alignées à gauche sous 640 px |

Mesures de laboratoire (mêmes conditions qu'à l'itération 1) :

| Page | LCP | CLS | JS | CSS | Polices | Images | Document |
|---|---|---|---|---|---|---|---|
| `/` | 184 ms | 0 | 507 Ko | 68 Ko | 82 Ko | 261 Ko | 147 Ko |
| `/pergolas` | 168 ms | 0 | 497 Ko | 68 Ko | 82 Ko | 74 Ko | 96 Ko |
| fiche SB400 | 168 ms | 0 | 511 Ko | 68 Ko | 82 Ko | 286 Ko | 148 Ko |
| configurateur SB400 | 172 ms | 0 | 591 Ko | 68 Ko | 82 Ko | 111 Ko | 439 Ko |

Limites : les photos en situation disponibles font au plus 828 px de large (1325 px pour le rendu CASABLANCA) ; affichées
plein écran, elles perdent en netteté. Des photographies HD fournies par le client sont nécessaires pour ce format. Les
captures client citées par la demande sont introuvables sur le VPS. Vérification dans Chromium uniquement.
