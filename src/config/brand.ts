/**
 * Identité centrale. Le nom d'affichage est PROVISOIRE (déduit du nom du dépôt) tant que
 * l'identité juridique n'est pas validée ; les coordonnées proviennent de SiteSettings
 * (administration) et restent vides tant qu'elles ne sont pas renseignées.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "ELIOS SOLAR",
  tagline: "Pergolas bioclimatiques, stores bannes et aménagement extérieur",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400",
  provisional: true,
} as const;

export const NAV = [
  { href: "/pergolas", label: "Pergolas" },
  { href: "/accessoires", label: "Accessoires" },
  { href: "/stores-bannes", label: "Stores bannes" },
  { href: "/configurateur", label: "Configurateur" },
  { href: "/comparer", label: "Comparer" },
  { href: "/realisations", label: "Réalisations" },
  { href: "/aide", label: "Aide" },
] as const;
