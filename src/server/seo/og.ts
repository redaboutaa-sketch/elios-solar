import { BRAND } from "@/config/brand";

/** Image de partage par défaut : logo intact sur plaque sombre (fichier publié, dimensions réelles). */
export const DEFAULT_OG_IMAGE = { url: BRAND.logoPlate.src, width: BRAND.logoPlate.width, height: BRAND.logoPlate.height, alt: BRAND.name };

/** Champs Open Graph communs : un `openGraph` de page remplace celui du gabarit, ils sont donc repris ici. */
export const OG_BASE = { siteName: BRAND.name, locale: "fr_FR" } as const;
