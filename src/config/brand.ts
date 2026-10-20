/**
 * Identité centrale. « HELIOSTORES » est la marque publique fournie par le client (logo seul, sans charte) ;
 * l'identité JURIDIQUE du vendeur (raison sociale, SIRET, adresse…) n'est pas encore validée : elle provient
 * de SiteSettings (administration) et reste vide tant qu'elle n'est pas renseignée.
 * Provenance du logo, palette et contrastes : docs/heliostores/identite.md.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "HELIOSTORES",
  tagline: "Pergolas, screens et stores bannes sur mesure",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400",
  /** identité juridique du vendeur non validée (mentions légales, CGV, factures) — ne pas passer à false sans validation */
  legalIdentityPending: true,
  /** logo d'origine (couleurs du client) détouré, fond transparent — à poser sur fond sombre (`night`) */
  logo: { src: "/brand/heliostores-logo.png", webp: "/brand/heliostores-logo.webp", width: 1230, height: 347 },
  /** logo intact sur plaque sombre arrondie — seule variante autorisée sur fond clair */
  logoPlate: { src: "/brand/heliostores-logo-plaque.png", webp: "/brand/heliostores-logo-plaque.webp", width: 1350, height: 427 },
  colors: { green: "#44664d", sage: "#8ab4a8", night: "#0b0f0d", greenDark: "#36523e", tint: "#f1f6f2" },
  themeColor: "#0b0f0d",
} as const;

/** Navigation principale : les trois familles (avec sous-menus produits, voir publicNavigation()) puis les services. */
export const NAV = [
  { href: "/pergolas", label: "Pergolas" },
  { href: "/screens", label: "Screens" },
  { href: "/stores-bannes", label: "Stores bannes" },
  { href: "/contact", label: "Conseil" },
  { href: "/devis", label: "Devis" },
  { href: "/aide", label: "Aide" },
] as const;

/** Liens de service (hors familles) de la navigation principale. */
export const NAV_SERVICES = NAV.slice(3);
