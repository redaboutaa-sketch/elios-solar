/**
 * Données structurées schema.org (JSON-LD) des pages publiques. Fonctions pures (testées) : rien n'est inventé.
 * - Organization : marque (name), entité juridique (legalName), URL et logo ; coordonnées commerciales publiques
 *   seulement (localité et e-mail renseignés dans les Réglages) : ni téléphone ni rue (décision du 2026-10-26).
 *   Aucun LocalBusiness tant qu'aucune adresse d'établissement recevant du public n'est validée.
 * - Product : jamais d'offre pour un produit sur devis (aucun prix 0), ni note, avis, stock, GTIN, marque ou fabricant.
 *   Une offre n'est émise que pour un prix public strictement positif, avec sa devise et sa base fiscale.
 * Le balisage valide ne rend pas une page éligible aux résultats enrichis de Google (Product sans offre : non éligible).
 */
export interface OrgInput { name: string; siteUrl: string; logoPath: string; legalName?: string | null; email?: string | null; address?: { postalCode?: string | null; city?: string | null; countryCode?: string | null } | null }

const abs = (siteUrl: string, path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`);

export function organizationJsonLd(o: OrgInput) {
  const a = o.address;
  const hasAddress = !!(a?.postalCode && a.city);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${abs(o.siteUrl, "/")}#organisation`,
    name: o.name,
    url: abs(o.siteUrl, "/"),
    logo: abs(o.siteUrl, o.logoPath),
    ...(o.legalName ? { legalName: o.legalName } : {}),
    ...(o.email ? { email: o.email } : {}),
    ...(hasAddress ? { address: { "@type": "PostalAddress", postalCode: a!.postalCode, addressLocality: a!.city, addressCountry: a!.countryCode ?? "FR" } } : {}),
  };
}

export interface Crumb { name: string; path: string }

/** Fil d'Ariane : accueil puis chaque niveau (URL absolues, sans paramètre). */
export function breadcrumbJsonLd(siteUrl: string, crumbs: Crumb[]) {
  const all = [{ name: "Accueil", path: "/" }, ...crumbs];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(siteUrl, c.path) })) };
}

export interface ProductInput { name: string; description: string; path: string; category: string; images: string[]; price?: { amountMinor: number; currency: string; taxBasis: "HT" | "TTC" | null } | null }

export function productJsonLd(siteUrl: string, p: ProductInput) {
  const url = abs(siteUrl, p.path);
  const priced = p.price && Number.isInteger(p.price.amountMinor) && p.price.amountMinor > 0 && /^[A-Z]{3}$/.test(p.price.currency) && p.price.taxBasis;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#produit`,
    name: p.name,
    description: p.description,
    url,
    category: p.category,
    ...(p.images.length ? { image: p.images.map((i) => abs(siteUrl, i)) } : {}),
    ...(priced
      ? {
          offers: {
            "@type": "Offer",
            url,
            priceCurrency: p.price!.currency,
            priceSpecification: { "@type": "PriceSpecification", minPrice: (p.price!.amountMinor / 100).toFixed(2), priceCurrency: p.price!.currency, valueAddedTaxIncluded: p.price!.taxBasis === "TTC" },
          },
        }
      : {}),
  };
}

/** Sérialisation sûre dans une balise <script> (aucune fermeture de balise possible depuis une donnée). */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
