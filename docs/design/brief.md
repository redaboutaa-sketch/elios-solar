# Brief design — refonte visuelle HELIOSTORES

Date : 2026-10-21. Périmètre : présentation, structure des pages et interactions. Les règles métier (catalogue, prix, devis,
commande, 3D, consentements, paiement simulé, protections de la préproduction) sont inchangées.

## Audit de départ (préproduction, commit d367e97)

Captures « avant » prises sur la préproduction réelle (médias importés), 390 px et 1440 px : accueil, collections, fiches,
configurateur, devis, panier, contact. Aucun défilement horizontal relevé.

| Constat | Effet | Réponse |
|---|---|---|
| L'accueil s'ouvre sur une photo SB400 ; les familles arrivent sous la ligne de flottaison | le visiteur ne choisit pas sa famille d'emblée (retour client) | sélecteur à trois dessins sous une introduction courte |
| Les cartes famille sont identiques et la photo SB400 apparaît deux fois | page monotone, information répétée | sélecteur illustré + liste des modèles + composition photo éditoriale |
| Collections : cartes identiques, image en `contain` sur fond blanc | peu de hiérarchie, pas de comparaison SB400 / SB500 | rangées alternées + comparatif des cotes documentées |
| Fiche : colonne d'achat courte, inclus et options mêlés dans l'onglet Description | distinction inclus / option peu visible | bloc « Inclus / En option » à deux colonnes, colonne d'achat restructurée |
| Configurateur : le prix disparaît au défilement ; étapes non repérées | l'effet d'un choix sur le prix n'est pas visible | colonne de gauche collante (aperçu + récapitulatif + prix), repères d'étapes, barre de prix mobile |
| Typographie Outfit (arrondie) | registre peu « architectural » | Manrope (titres) + Inter (texte) |
| Animations : aucune, hormis transitions de couleur | — | micro-interactions CSS courtes, `prefers-reduced-motion` respecté |

## Outils vérifiés

- Présents : Next 16.4.2 (App Router, `next/font`), React 19.3, Tailwind CSS 4.3, three 0.186 (3D existante), Playwright 1.64, lucide-react.
- Absents du projet et de l'environnement : Motion for React, GSAP, Magic UI, React Bits, axe-core, skills « Frontend Design » / « UI UX Pro Max » / « Design Hook ».
- Décision : **aucune dépendance ajoutée**. Les besoins (survol des dessins, menus, apparitions, transitions de galerie)
  sont couverts par CSS (transitions, `@keyframes`, morphing SVG `d`, `animation-timeline: view()` en amélioration progressive).
  axe-core est utilisé ponctuellement hors dépôt pour l'audit d'accessibilité.

## Besoins utilisateur

- **US-DES-001** — En arrivant, je choisis ma famille en cliquant sur un dessin du produit.
- **US-DES-002** — Je vois les modèles disponibles et leurs différences avant d'ouvrir une fiche.
- **US-DES-003** — Sur une fiche, je distingue ce qui est inclus de ce qui est en option.
- **US-DES-004** — Dans le configurateur, je vois en permanence l'aperçu, mon récapitulatif et le prix.
- **US-DES-005** — Sur mobile, je configure sans que le chat, les cookies ou la barre d'action masquent les champs.
- **US-DES-006** — Au clavier ou avec les animations réduites, j'accède aux mêmes contenus.

## Hypothèses (design uniquement, réversibles)

- Typographies Manrope et Inter (Google Fonts, licence OFL) : choix d'interface, ce n'est pas la police du logo.
- Les trois dessins sont des illustrations d'orientation créées pour le site, pas des plans de fabrication.
- Les photos restent celles de la médiathèque, présentées comme « photo de documentation produit » ; Réalisations reste masquée.
- La FAQ de l'accueil reprend uniquement des faits déjà publiés (prix HT de la grille, commande de la structure seule,
  livraison et pose non comprises, 3D indicative).
