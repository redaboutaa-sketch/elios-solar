/**
 * Identité centrale. « HELIOSTORES » est la marque publique fournie par le client (logo seul, sans charte) ;
 * l'identité JURIDIQUE du vendeur (raison sociale, SIRET, adresse…) n'est pas encore validée : elle provient
 * de SiteSettings (administration) et reste vide tant qu'elle n'est pas renseignée.
 * Provenance du logo, palette et contrastes : docs/heliostores/identite.md.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "HELIOSTORES",
  tagline: "Pergolas, screens, stores bannes et moustiquaires sur mesure",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400",
  /** identité juridique du vendeur non validée (mentions légales, CGV, factures) — ne pas passer à false sans validation */
  legalIdentityPending: true,
  /** logo d'origine (couleurs du client) détouré, fond transparent — à poser sur fond sombre (`night`) */
  logo: { src: "/brand/heliostores-logo.png", webp: "/brand/heliostores-logo.webp", width: 1240, height: 347 },
  /** logo intact sur plaque sombre arrondie — seule variante autorisée sur fond clair */
  logoPlate: { src: "/brand/heliostores-logo-plaque.png", webp: "/brand/heliostores-logo-plaque.webp", width: 1360, height: 427 },
  /** bleu-vert du logo (dominant), vert HELIO, orange d'accent provisoire (proposition, voir identite.md) */
  colors: { teal: "#8ab4a8", tealDark: "#396558", green: "#44664d", accent: "#c2410c", night: "#0b0f0d", tint: "#eef5f3" },
  themeColor: "#0b0f0d",
} as const;

/**
 * Rubriques publiques masquées (réponse 404, hors navigation et sitemap) tant qu'aucun contenu réel et autorisé n'est
 * fourni — décision client du 2026-10-21. Les fiches restent gérables dans l'administration.
 */
export const PUBLIC_SECTIONS = { realisations: false, production: false, showroom: false, references: true } as const;

/** Navigation principale (en-tête) : services seulement — le catalogue est dans la navigation latérale et le menu mobile. */
export const NAV = [
  { href: "/guides", label: "Installation et guides" },
  ...(PUBLIC_SECTIONS.references ? [{ href: "/references", label: "Références" }] : []),
  { href: "/contact", label: "Contact" },
  { href: "/devis", label: "Devis" },
] as const;

/** Liens de service (hors familles) : en-tête, menu mobile. */
export const NAV_SERVICES = NAV;

/** Rubriques de la navigation latérale, après les familles. */
export const SIDEBAR_LINKS = [
  { href: "/accessoires", label: "Options et accessoires" },
  { href: "/guides", label: "Installation et guides" },
  { href: "/guides/prise-de-mesures", label: "Prise de mesures" },
  ...(PUBLIC_SECTIONS.references ? [{ href: "/references", label: "Références" }] : []),
  { href: "/modes-de-paiement", label: "Modes de paiement" },
  { href: "/contact", label: "Contact" },
] as const;
