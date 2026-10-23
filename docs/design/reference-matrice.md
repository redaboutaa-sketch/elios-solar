# Matrice comparative — référence fabricant → HELIOSTORES

Date : 2026-10-21. Référence examinée en consultation seule (aucun formulaire envoyé, aucun consentement donné ;
bandeaux masqués localement pour la capture) : accueil, protection solaire, pergolas et fiche SB 400 du site
aluprof.com/fr, à 1440 et 390 px. Les captures restent hors du dépôt.

**Limite :** les deux captures client citées dans la demande (`image(20261021-142212).png`, `image(20261021-142253).png`)
ne se trouvent ni dans `inputs/` ni ailleurs sur le VPS. La comparaison s'appuie sur la référence en ligne.

Le site public ne cite pas la référence : aucun nom, logo, couleur institutionnelle (bleu, orange), ambassadeur,
distinction ni coordonnée n'est repris.

| Élément observé | Adaptation HELIOSTORES | Contrôle |
|---|---|---|
| Hero photographique plein écran, carrousel numéroté | Grand visuel 88 svh (min. 34 rem), 3 vues en situation (une par famille), commandes visibles, flèches du clavier, aucune lecture automatique ; seule la vue active est chargée | captures 1440 / 390 ; clavier ; `prefers-reduced-motion` (fondu supprimé) |
| En-tête transparent sur le hero, puis fond plein | `HeaderShell` : en-tête fixe et transparent sur l'accueil, fond plein et hauteur réduite (72 → 64 px) au défilement ; collant ailleurs | capture défilée ; contraste du logo sur voile sombre |
| Navigation fabricant (produits, téléchargements, formation, BIM…) | Nos solutions (panneau à 3 colonnes illustrées) · Guides · Contact · Devis · compte · « Configurer mon projet » ; Réalisations seulement si la rubrique est publiée | e2e 01 (familles dans l'en-tête, aucun lien Réalisations) |
| Section « Offre » : panneaux verticaux photo + pictogramme au trait, panneau actif élargi (~450 px contre 150), « Voir plus » | « Nos solutions » : 3 panneaux photo, dégradé bas, dessin HELIOSTORES au trait blanc, nom toujours visible ; panneau actif à 50 % (700 px contre 350 à 1440 px), « Découvrir la gamme » révélé ; transition CSS de `flex-grow` | largeurs mesurées : 467/467/467 au repos, 350/700/350 au survol, idem au focus clavier ; tactile : panneaux empilés, CTA visible |
| Fiches produits sur fond blanc (rendu isolé) | Onglets « Nos modèles » par famille ; rendus produit sur fond blanc, prix « à partir de », Découvrir / Configurer | capture ; e2e 01 (prix affiché) |
| — (configurateur absent de la référence) | « Composez votre projet » : rendu fixe, puis vue 3D existante chargée au clic (modèle de scène calculé côté serveur) | clic → canevas 3D affiché ; three.js absent du chargement initial |
| Page famille : bandeau photo titré, grille de produits sur blanc, filtres techniques | Bandeau photo + fil d'Ariane clair + dessin au trait ; 2 modèles = 2 grandes présentations (rendu sur blanc) ; comparatif fondé sur les données ; pas de filtres (inutiles pour 1 à 2 modèles) | captures ; e2e 01 (liste, prix) |
| Fiche : galerie « Visualisation / Dessin technique », miniatures, onglets d'information, rangées image + texte | Modes « Photos et rendus » / « Vue 3D » / « Dessins techniques » (un mode vide n'est pas proposé) ; agrandissement dans un `<dialog>` ; onglets Présentation, Caractéristiques, Dimensions et pose, Finitions, Commande et installation, Documents, Questions ; « en détail » en rangées alternées (médias de détail et leur légende) | SB400 : 3 modes ; SB500 : 2 modes (aucun dessin publié) ; Échap ferme et rend le focus ; e2e 07 |
| Typographie géométrique, boutons nets | Montserrat (titres) + Inter (texte), rayons 2 à 8 px, boutons rectangulaires ; vert #44664D (action) et sauge #8AB4A8 (accents), neutres clairs | revue des tokens ; axe (contrastes) |
