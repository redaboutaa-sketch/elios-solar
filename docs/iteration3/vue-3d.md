# Vue 3D du configurateur (itération 3)

> **Visualisation indicative — ne constitue pas un plan d'exécution.** La vue 3D aide à se projeter.
> Elle ne valide ni une structure, ni une cote de pose, ni la compatibilité d'un assemblage.

## Architecture

| Fichier | Rôle |
| --- | --- |
| `src/domain/scene-model.ts` | Modèle de scène **pur** (sans React ni three.js), déterministe et sérialisable en JSON : `buildSceneModel(catalog, input, result?)`, `buildPergolaSceneModel`, `buildAwningSceneModel`. |
| `src/components/configurator/scene-3d/visuals.tsx` | Sélecteur « Illustration / Plan 2D / Vue 3D » (`PergolaVisuals`, `AwningVisuals`). Charge la 3D avec `next/dynamic` (`ssr: false`) **seulement au clic** sur « Vue 3D » (`data-testid="view-3d-toggle"`). |
| `scene-3d/viewer-3d.tsx` | `PergolaScene3D` / `AwningScene3D` : canvas (`data-testid="scene-3d"`), vues prédéfinies, jour/nuit, curseur des lames ou du déploiement de la toile, export PNG, sélection d'ouverture au clic. |
| `scene-3d/scene-engine.ts` | Renderer three.js, détection WebGL, `OrbitControls`, rendu à la demande, pause quand l'onglet est caché, capture, `dispose()`. |
| `scene-3d/pergola-builder.ts`, `awning-builder.ts` | Géométrie procédurale construite à partir du modèle de scène. |
| `scene-3d/export-image.ts` | Assemble la capture et un bandeau texte sur un canvas 2D, puis télécharge `projet-elios-solar.png`. |

`three` n'est importé que dans `scene-3d/*`, et on n'y accède que par l'`import()` dynamique de
`viewer-3d.tsx` : il n'entre ni dans le bundle serveur ni dans le JS initial de la page.
Les configurateurs (`pergola-configurator.tsx`, `awning-configurator.tsx`) n'ont été modifiés que dans la colonne visuelle et leurs imports.

## Ce qui est représenté (d'après la configuration)

- **Dimensions** largeur × longueur exactes (mm → m). L'**implantation** est également représentée : en *autoportée*, 4 poteaux d'angle ; en *adossée*, un mur sur le côté arrière, la poutre arrière fixée au mur et 2 poteaux avant.
- **Poteaux intermédiaires** sur les côtés divisés (côté ≥ `dividerThresholdMm`, 6 m dans le catalogue démo). Ils viennent de `Layout.segments[].hasDividerPost`. Une 4×6 autoportée compte ainsi 6 poteaux.
- **Poutres** périphériques avec gouttière, et **lames** orientables dont l'orientation est animée par le curseur « Ouverture des lames » (0–90°).
- **Couleurs** structure et lames issues de la finition. Avec « Anthracite, lames blanches », les deux couleurs sont bien distinctes.
- **Fermetures par segment** (`left-1`, `back-2`…), sur le bon côté, à la bonne longueur :
  - paroi vitrée translucide : fixe, coulissante avec cadre (plusieurs vantaux encadrés) ou sans cadre (rails seuls) ;
  - persienne à lattes. Les persiennes de 5/6 m sont dessinées en **2 modules avec poteau intermédiaire**, d'après les attributs `assembly` / `modules` / `intermediatePosts` de la variante. Quand l'assemblage n'est pas confirmé par le fournisseur, la description l'indique : « assemblage à confirmer » ;
  - store vertical ZIP : coffre, coulisses et toile.
- **Éclairage** :
  - LED de gouttière, incluses sur Solis Pro même sans option, ou ajoutées par l'option « Bandes LED » ;
  - LED intégrées aux lames sur Solis Max ;
  - couleur blanc chaud ou **RGB** (dégradé).
  
  L'éclairage s'allume en ambiance **nuit**.
- **Lampes chauffantes** (nombre choisi, sous la poutre avant) et **lanternes** (posées au sol).
- **Store banne** :
  - largeur et avancée ;
  - coffre et toile aux couleurs choisies ;
  - barre de charge et bras articulés ;
  - supports muraux ou plafond (2, ou 3 à partir de 5 m, comme dans le moteur) ;
  - LED du coffre et anémomètre si l'option est prise ;
  - **déploiement animé** de la toile (curseur 0–100 %).
- **Sol / terrasse** et, en adossée ou pour le store, une **façade**.

Une description textuelle de la scène est affichée sous le canvas (`#scene-3d-description`, liée par `aria-describedby`). Elle sert à l'accessibilité et rend la scène vérifiable en test.

## Ce qui est indicatif

Le modèle les marque avec `indicative: { … : true }`.

- **Hauteur** : 2 500 mm pour la pergola et 2 600 mm de hauteur de pose pour le store (`INDICATIVE_HEIGHT_MM`, `INDICATIVE_AWNING_HEIGHT_MM`). La hauteur de passage réelle est « à confirmer » dans les fiches.
- **Sections** de poteaux et poutres (120 mm et 200 mm), épaisseurs des profils et des vitrages.
- **Nombre de lames** : il est déduit d'un entraxe indicatif de 200 mm. Ce n'est pas la nomenclature fournisseur.
- **Emplacement des accessoires** (chauffages, lanternes), **inclinaison de la toile** (14°) et **géométrie des bras** du store.
- **Assemblages modulaires** de persienne : ils sont représentés tels que décrits par la variante démo, sans validation du fournisseur.

## Interactions et garanties

- Les interactions de visualisation restent un **état local** du viewer : vues Face / Trois quarts / Dessus / Intérieur, rotation et zoom, jour/nuit, lames, déploiement. Elles ne modifient **jamais** `input`, donc ni le prix ni la configuration. Les tests e2e le vérifient en comparant le total avant et après.
- Le **plan 2D reste affiché sous la vue 3D**, et ses ouvertures restent sélectionnables. En 3D, un clic (sans glisser) sur une ouverture appelle `onSelect(segmentId)` : la sélection s'ouvre dans l'étape « Ouvertures latérales » et l'ouverture est surlignée en cuivre.
- **Sans WebGL**, ou si la création du contexte échoue ou que le contexte est perdu, un message s'affiche (`data-testid="scene-3d-unavailable"`) avec l'illustration existante. Le plan 2D reste disponible et le configurateur entièrement utilisable.
- **Export** : le bouton « Exporter l'image du projet » fait un rendu synchrone puis un `toDataURL` (pas de `preserveDrawingBuffer` permanent). Un bandeau est ajouté avec :
  - la gamme ;
  - la dimension ;
  - la finition (et l'implantation) ;
  - la mention « Visualisation indicative — ne constitue pas un plan d'exécution — ELIOS SOLAR (démonstration) ».

  Le fichier téléchargé est `projet-elios-solar.png`. Le dataURL est aussi transmis au parent par la prop `onImage?: (dataUrl) => void`, pour qu'un futur devis puisse le joindre. Elle n'est pas encore branchée dans les configurateurs.

## Performance et coût mobile

- `devicePixelRatio` plafonné à 1,5. Antialiasing désactivé sous 768 px de large, où la carte d'ombre passe aussi de 2048 à 1024.
- **Rendu à la demande uniquement** : sur changement de scène, interaction `OrbitControls` ou transition de vue (350 ms, désactivée avec `prefers-reduced-motion`). Il n'y a aucune boucle permanente, donc aucune consommation au repos.
- Pas de rendu quand l'onglet est caché (`visibilitychange`). Au démontage (retour à « Illustration »), `dispose()` libère géométries, matériaux, renderer et contexte WebGL (`forceContextLoss`).
- Les lames et lattes sont dessinées en `InstancedMesh` (quelques dizaines d'appels de dessin au total). Le nombre de lumières ponctuelles est fixe (≤ 4), sans ombre, ce qui évite les recompilations de shaders.
- Coût : three.js et le viewer forment un chunk séparé d'environ 150 Ko gzip (ordre de grandeur), téléchargé **seulement au clic**. Sur mobile milieu de gamme, la première ouverture coûte ce téléchargement plus la compilation des shaders (quelques centaines de ms). En usage, chaque interaction déclenche un rendu ponctuel.

## Limites

- Vue schématique : pas de rendu photoréaliste ni de textures, pas de modèle téléchargé (géométrie procédurale).
- **Aucun calcul structurel** (vent, neige, portées, fondations), aucune cote d'exécution.
- Les empilements (store + vitrage sur la même ouverture) ne sont pas représentés : ils ne sont pas proposés par le configurateur.
- La pergola sur mesure (`pergola_custom`) n'a pas de vue 3D : `buildSceneModel` retourne `null` pour ce type.
- La sélection d'ouverture au clic en 3D n'est pas accessible au clavier. Le plan 2D et la liste des ouvertures restent le chemin accessible.

## Tests

- `tests/unit/scene-model.test.ts` (13 tests) :
  - 3×4 autoportée ;
  - 4×6 : poteaux intermédiaires à x = 3 m sur les côtés avant et arrière ;
  - adossée : 2 poteaux, mur et absence d'ouverture arrière ;
  - fermeture sur `left-1` ;
  - persienne modulaire de 5 m ;
  - éclairage Solis / Solis Pro / Solis Max ;
  - bandes LED RGB ;
  - finition bicolore ;
  - chauffages et lanternes ;
  - déterminisme et sérialisation JSON ;
  - store banne (largeur, avancée, coffre, toile, supports, anémomètre) ;
  - type non représenté → `null`.
- `tests/e2e/08-vue-3d.spec.ts` (projets desktop et mobile). Chromium est lancé avec `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` pour que le WebGL logiciel soit disponible. Si WebGL manque malgré tout, la spec vérifie le message de repli. Scénarios couverts :
  - aucun canvas avant le clic ;
  - chargement de la 3D ;
  - le plan 2D reste visible ;
  - vues prédéfinies, nuit, curseur des lames, rotation à la souris ;
  - export (`projet-elios-solar.png`) ;
  - total et ligne de fermeture inchangés ;
  - aucune erreur de page ;
  - Solis Pro 4×6 : 6 poteaux, LED de gouttière, finition bicolore ;
  - store banne : curseur de déploiement, nuit, total inchangé.

  Captures produites : `tests/e2e/screenshots/vue-3d-*.png` et `vue-3d-store-*.png`.

## Résultats (2026-10-19)

- `pnpm typecheck` : 0 erreur.
- `pnpm lint` : 0 erreur (1 avertissement préexistant hors périmètre : `realisations/page.tsx`).
- `pnpm test:unit` : 6 fichiers, 105 tests réussis.
- `E2E_NO_SERVER=1 pnpm playwright test tests/e2e/08-vue-3d.spec.ts` : 6/6 réussis (desktop + mobile), avec canvas WebGL réel via SwiftShader.
- Non-régression : `tests/e2e/01-configurateur.spec.ts` (desktop) 3/3 réussis.

## Reste à faire

- Brancher `onImage` sur la demande de devis (pièce jointe) et sur le PDF projet.
- Remplacer les valeurs indicatives (hauteur, sections, entraxe des lames) par les données fournisseur validées, quand elles existeront dans le catalogue.
- Vue 3D éventuelle pour le sur-mesure (hauteur saisie) une fois les bornes fournisseur confirmées.
- Mesurer le poids réel du chunk 3D au `pnpm build` (non lancé ici, à la demande du coordinateur).
