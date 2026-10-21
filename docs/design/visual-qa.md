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
