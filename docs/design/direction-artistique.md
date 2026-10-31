# Direction artistique HELIOSTORES

> **Mise à jour 2026-10-21 (b)** — refonte « catalogue fabricant » demandée par le client : grands visuels photographiques,
> en-tête superposé puis compact, panneaux de familles extensibles, présentation des modèles sur fond blanc, contours nets.
> Elle remplace la composition « sketches avant tout visuel » ; les dessins restent la signature, au trait blanc sur les
> panneaux photo. Typographie des titres : **Montserrat** (au lieu de Manrope) ; rayons ramenés à 2–8 px ; boutons
> rectangulaires. Matrice de correspondance avec la référence : `reference-matrice.md`. Les sections ci-dessous restent
> valables sauf mention contraire (couleurs, mouvement, accessibilité).

**Univers : architecture contemporaine, précision du produit, lumière naturelle et confort extérieur.**
Composition sobre, grands blancs, trait fin ; la couleur forte est réservée à l'action et aux éléments qui aident à choisir.

## Couleurs (tokens `src/app/globals.css`)

| Rôle | Token | Valeur | Usage |
|---|---|---|---|
| Fond | `sand-50` | #f7f8f5 | fond de page |
| Surface | `white` / `sand-100` | #fff / #eef1ec | cartes, bandeaux alternés |
| Texte | `ink` | #1a201c | texte courant (contraste 16:1 sur fond) |
| Texte secondaire | `stone-700` | #5b5f63 | légendes (6,1:1) |
| Bordure | `sand-200` / `sand-300` | #dfe4dd / #c8d0c7 | séparateurs, champs |
| Action | `brand-700` | **#44664D** (vert du logo) | boutons principaux, liens (6,4:1 avec le blanc) |
| Accent | `sage-400` | **#8AB4A8** (sauge du logo) | aplats des dessins, fonds sombres ; **jamais en texte sur fond clair** (2,3:1) |
| Surface sombre | `night` | #0b0f0d | en-tête, pied de page (logo détouré) |

## Typographie

- Titres : **Montserrat** (600–700, interlettrage -0,015 em ; Manrope avant le 2026-10-21 b), échelle fluide `clamp()` : `--text-hero` 2,5→4,25 rem, `h2` 1,9→2,75 rem.
- Texte et interface : **Inter** (400–600), 16 px minimum pour le texte, 14 px pour les légendes.
- Surtitres : Inter 12 px, capitales, interlettrage 0,16 em, vert `brand-700`.
- Chiffres tabulaires pour les prix et les cotes.

## Grille et espacements

- Largeur maximale 80 rem (`container-x`), gouttières 16 / 24 / 32 px.
- Rythme vertical des sections : `--section-y` = clamp(4 rem, 8 vw, 7 rem).
- Rayons : 2–3 px (boutons, commandes), 6 px (cartes), 8 px au plus ; panneaux photo et grilles sans arrondi.
- Ombres : une seule ombre douce (`shadow-soft`) ; séparation de préférence par filets 1 px.

## Dessins (signature)

- Trois illustrations SVG originales (`src/components/illustrations/sketches.tsx`) : projection isométrique commune calculée
  en mètres, trait 1,6 px `ink`, aplats sauge translucides, sol vert pâle, petit soleil en accent.
- Pergola : quatre poteaux, cadre, lames orientables. Screen : baie, coffre, coulisses, toile tendue. Store banne : façade,
  coffre, toile inclinée, bras articulés, lambrequin.
- Interaction : au survol ou au focus, l'élément mobile du produit joue son mouvement (lames qui s'ouvrent, toile qui
  descend, bras qui se déploient), en 600 ms. Morphing SVG `d` : sans support (Safari) ou avec animations réduites, le
  dessin reste statique et le lien fonctionne de la même manière.

## Mouvement

- Durées : 150 ms (états), 250 ms (menus, panneaux), 600 ms (dessins). Courbe `--ease-out` cubic-bezier(.2,.7,.2,1).
- Apparition des sections : glissement de 12 px lié au défilement (`animation-timeline: view()`), uniquement si le
  navigateur le permet et sans réduction des animations. Pas de fondu : un fondu lié au défilement laissait les sections
  quasi invisibles en capture pleine page (constaté en QA) ; le contenu n'est jamais masqué.
- Aucune animation ne retarde l'accès aux produits ; défilement natif conservé.

## Contrôle de la direction (fait avant l'implémentation)

- Marque : logo inchangé, posé sur surface sombre ; vert et sauge du logo ; aucune couleur claire en texte. ✅
- Retour client : sélecteur à dessins au-dessus de la ligne de flottaison sur desktop et mobile. ✅
- Parcours : CTA « Configurer mon projet » et « Demander un devis » conservés ; aucun champ ni règle modifiés. ✅
- Médias : réalisable avec les photos et rendus existants ; états vides prévus. ✅
- Mobile et performance : SVG inline légers (pas d'image), aucune bibliothèque, pas de 3D sur l'accueil. ✅
