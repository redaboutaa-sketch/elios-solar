# Plan d'implémentation — refonte visuelle

Chaque tâche : besoin, changement visuel, pages, critère d'acceptation, contrôle. Ordre d'exécution = ordre du tableau.

| ID | Besoin | Changement | Pages | Critère d'acceptation | Contrôle |
|---|---|---|---|---|---|
| TR-DES-001 | US-DES-006 | Tokens : Manrope + Inter, échelle `clamp()`, rayons, durées, `.reveal`, `.eyebrow`, focus visible | toutes | une seule source de tokens ; focus visible partout | revue CSS, captures |
| TR-DES-002 | US-DES-001 | En-tête : CTA « Configurer mon projet », méga-menu avec dessin par famille, menu mobile avec tuiles dessinées, focus géré (ouverture, Échap, retour) | toutes | les trois familles accessibles en 1 clic sur desktop et mobile ; Échap ferme et rend le focus | clavier, 360–1440 px |
| TR-DES-003 | US-DES-001 | Dessins SVG pergola / screen / store banne, survol et focus animés, statiques en mouvement réduit | accueil, menus, collections | silhouettes reconnaissables ; lien entier cliquable ; nom et description toujours visibles | captures, `reducedMotion` |
| TR-DES-004 | US-DES-001/002 | Accueil : intro courte → sélecteur → modèles → photos → parcours → FAQ → CTA final | `/` | sélecteur visible sans défiler à 1440 px et commence dans le premier écran à 390 px | captures 360/390/768/1024/1440 |
| TR-DES-005 | US-DES-002 | Collections : bandeau avec dessin, rangées alternées, comparatif SB400 / SB500 | `/pergolas`, `/screens`, `/stores-bannes` | comparatif lisible à 360 px sans défilement horizontal de page | captures, débordement |
| TR-DES-006 | US-DES-003 | Fiche : colonne d'achat restructurée, bloc Inclus / En option, galerie à transition | fiches | inclus et options dans deux colonnes distinctes ; onglets conservés | e2e 01/07, captures |
| TR-DES-007 | US-DES-004/005 | Configurateur : aperçu + récapitulatif + prix collants (desktop), repères d'étapes, barre de prix mobile, chat relevé | `/configurateur/*` | prix visible pendant toute la saisie ; aucun champ masqué par la barre ou le chat | e2e 02/03/08, captures mobile |
| TR-DES-008 | US-DES-006 | Micro-interactions : menus, galerie, sélection, retours d'envoi ; `prefers-reduced-motion` | toutes | aucune animation > 600 ms ; rien de caché sans JS | revue, `reducedMotion` |
| TR-DES-009 | tous | QA : 5 largeurs, zoom 200 %, axe-core, mesures avant/après | pages représentatives | 0 débordement ; 0 violation axe sérieuse | `docs/design/visual-qa.md` |
