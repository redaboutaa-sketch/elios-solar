/** Types partagés (serveur et composants client) pour les médias de la boutique. */
/** Média publié, aplati pour les composants client de la boutique. */
export interface PublishedMedia {
  id: string;
  path: string;
  externalUrl: string | null;
  alt: string;
  title: string;
  nature: "PHOTO" | "RENDER" | "ILLUSTRATION" | "VIDEO" | "DOCUMENT";
  caption: string;
  role: string;
  credit: string;
  visibleOptions: string;
  width: number | null;
  height: number | null;
  finishCode: string | null;
  mounting: string | null;
  /** variante réduite (vignettes), si l'import en a produit une */
  smallPath?: string | null;
  /** provenance lisible (fichier + page ou URL) et rattachement au modèle */
  sourceLabel?: string | null;
  match?: string | null;
}

export const NATURE_FR: Record<PublishedMedia["nature"], string> = { PHOTO: "Photographie", RENDER: "Visualisation 3D — rendu, pas une photographie", ILLUSTRATION: "Illustration", VIDEO: "Vidéo", DOCUMENT: "Document" };

export const MEDIA_NATURES = ["PHOTO", "RENDER", "ILLUSTRATION", "VIDEO", "DOCUMENT"] as const;
export const MEDIA_STATUSES = ["DRAFT", "VALIDATED", "PUBLISHED", "REJECTED"] as const;
export type MediaStatusValue = (typeof MEDIA_STATUSES)[number];
