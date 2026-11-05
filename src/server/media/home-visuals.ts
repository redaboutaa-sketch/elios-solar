/**
 * Visuels du carrousel de l'accueil (un par famille) — métadonnées publiables, aucun fichier binaire dans le dépôt.
 *
 * Visualisations photoréalistes générées, fournies par le client le 2026-10-27 (`inputs/heliostores/homepage/`, hors
 * Git et hors Docker ; originaux conservés tels quels). Ce ne sont ni des photographies du fabricant, ni des
 * réalisations HELIOSTORES, et elles ne représentent pas un modèle précis du catalogue : légende publique
 * « Visualisation », texte alternatif descriptif sans nom de modèle. Importées dans la médiathèque par
 * `scripts/import-home-visuals.ts` (variantes WebP et AVIF à 640, 1080 et 1672 px, noms publics descriptifs).
 *
 * `focus` : position de l'image (`object-position`) dans le cadre du carrousel, sur mobile (cadre étroit et haut :
 * seule une bande verticale est visible) et à partir de 1024 px (cadre proche du format de l'image).
 */
import type { CategoryKey } from "@/domain/categories";

export interface HomeVisual {
  key: string;
  category: CategoryKey;
  /** fichier original dans le dossier fourni */
  file: string;
  /** préfixe des noms publics (minuscules, tirets, sans référence fournisseur) */
  slug: string;
  title: string;
  alt: string;
  focus: { mobile: string; desktop: string };
  sortOrder: number;
}

export const HOME_VISUALS_RECEIVED = "2026-10-27";
export const HOME_VISUALS_RIGHTS = "Visualisation photoréaliste générée, fournie par le client pour le site HELIOSTORES (2026-10-27). Ce n'est ni une photographie du fabricant, ni une réalisation HELIOSTORES, et elle ne représente pas un modèle précis du catalogue.";

export const HOME_VISUALS: HomeVisual[] = [
  {
    key: "home-pergola", category: "PERGOLAS", file: "pergola.png", slug: "visualisation-pergola-lames-orientables-terrasse", sortOrder: 0,
    title: "Visualisation — pergola à lames orientables",
    alt: "Visualisation d'une pergola à lames orientables gris anthracite sur une terrasse en pierre claire, au-dessus d'un salon de jardin, avec vue sur la mer et les collines.",
    focus: { mobile: "72% 50%", desktop: "50% 50%" },
  },
  {
    key: "home-screen", category: "SCREENS", file: "screen.png", slug: "visualisation-store-screen-baie-vitree", sortOrder: 1,
    title: "Visualisation — store screen vertical",
    alt: "Visualisation d'un store screen vertical gris anthracite à demi déroulé devant une grande baie vitrée, sur une terrasse avec vue sur la mer.",
    focus: { mobile: "28% 50%", desktop: "50% 50%" },
  },
  {
    key: "home-store-banne", category: "STORES_BANNES", file: "store-banne.png", slug: "visualisation-store-banne-bras-articules-terrasse", sortOrder: 2,
    title: "Visualisation — store banne à bras articulés",
    alt: "Visualisation d'un store banne à bras articulés, toile beige et armature gris anthracite, déployé au-dessus d'une table de terrasse face à la mer.",
    focus: { mobile: "50% 50%", desktop: "50% 50%" },
  },
  {
    key: "home-moustiquaire", category: "MOUSTIQUAIRES", file: "moustiquaire.png", slug: "visualisation-moustiquaire-plissee-baie-coulissante", sortOrder: 3,
    title: "Visualisation — moustiquaire plissée",
    alt: "Visualisation d'une moustiquaire plissée gris anthracite tirée devant une partie d'une baie coulissante ouverte sur un séjour.",
    focus: { mobile: "60% 50%", desktop: "50% 50%" },
  },
];
