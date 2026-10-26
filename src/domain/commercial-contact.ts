/**
 * Coordonnées commerciales publiques (pied de page, Contact, confirmations, documents, données structurées) :
 * marque HELIOSTORES, localité et e-mail de contact. Décision du propriétaire (2026-10-26) : ni téléphone ni rue en
 * présentation commerciale. L'identité juridique complète (THYSENS, siège, téléphone de l'éditeur) reste réservée
 * aux mentions légales.
 */
export interface ContactSettings { postalCode?: string | null; city?: string | null; countryCode?: string | null; contactEmail?: string | null }
export interface CommercialContact { name: string; postalCode: string | null; city: string | null; countryCode: string; locality: string | null; email: string | null }

const COUNTRY_FR: Record<string, string> = { FR: "France", BE: "Belgique", LU: "Luxembourg", CH: "Suisse" };

export function commercialContact(s: ContactSettings | null | undefined, brandName: string): CommercialContact {
  const countryCode = s?.countryCode || "FR";
  const place = [s?.postalCode, s?.city].filter(Boolean).join(" ");
  const country = COUNTRY_FR[countryCode] ?? countryCode;
  return { name: brandName, postalCode: s?.postalCode || null, city: s?.city || null, countryCode, locality: place ? `${place}, ${country}` : null, email: s?.contactEmail || null };
}
