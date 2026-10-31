/**
 * Données publiques des systèmes : le site ne cite ni le fabricant, ni le fournisseur, ni ses références
 * (décisions client des 2026-10-21, 2026-10-22 et 2026-10-25 : nomenclature commerciale HELIOSTORES). Les sources et les
 * désignations du fournisseur restent en base et dans l'administration ; elles sont retirées de tout ce qui part
 * vers le navigateur.
 */
import type { SystemRules } from "./system";
import type { TechnicalSpecValue } from "./technical-spec";

/**
 * Noms qui ne doivent apparaître sur aucune page publique, ni dans les données envoyées au navigateur (garde-fou
 * des tests et du contrôle des médias) : fabricant, fournisseur, références des produits et des moteurs.
 */
export const PUBLIC_FORBIDDEN_NAMES =
  /aluprof|thysens|\bselt\b|euro[\s-]?confort|\bsb\s?[3-5][05]0\b|refleksol|zi{2,}p|\bzip\s?120\b|\br\s?120\b|veranda\s?fts|\bfts\b|sunbreaker|zoomtech|blebox|elero|somfy|linak|picolo|\baltus\b|sunilus|suntop|varieco|\bdm45|palladio|tahoma|eolis|soliris|ondeis|madeira|open\s?slide|system\s?slide|veranda\s?v\b|pergola\s?solid|\bmph\s?(harmony|dual|verti)\b|\bm(zn|zh|zp|rp|rs|rsz|ro)\b/i;

/**
 * Entité juridique du vendeur (décision du propriétaire du 2026-10-26) : THYSENS exploite la marque HELIOSTORES. Son nom
 * figure dans l'identité légale du site (pied de page, mentions légales, confidentialité, données structurées
 * Organization) et jamais dans un contenu produit, où il reste interdit (PUBLIC_FORBIDDEN_NAMES).
 */
export const SELLER_LEGAL_NAME = "THYSENS";

/** Texte d'une page publique sans les mentions de l'entité juridique du vendeur (contrôle des fuites hors identité légale). */
export function withoutSellerIdentity(text: string): string {
  return text.replace(new RegExp(`\\b${SELLER_LEGAL_NAME}\\b`, "gi"), "");
}

/**
 * Anciens noms commerciaux (alias internes depuis la transcodification HELIO du 2026-10-31) et désignations des modèles
 * chez le fournisseur : jamais dans un texte public. Sensible à la casse : les slugs historiques en minuscules
 * (`/stores-bannes/casablanca`…) restent des URL valides et ne sont pas visés.
 */
export const PUBLIC_RETIRED_NAMES = /\b(Malaga|Marbella|Sevill?i?a|Casablanca|Corsica|Jamaica|Madera|CASABLANCA|CORSICA|JAMAICA|MADERA)\b|HelioRoof Screen/;

/** Clés internes retirées des règles publiques. */
const INTERNAL_RULE_KEYS = new Set(["sources", "supplierRef"]);

/** Copie des règles sans source ni désignation du fournisseur. */
export function publicSystemRules(rules: SystemRules): SystemRules {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !INTERNAL_RULE_KEYS.has(k) || k === "sources").map(([k, x]) => [k, k === "sources" ? [] : strip(x)]));
    return v;
  };
  return strip(rules) as SystemRules;
}

/** Caractéristiques de traçabilité, jamais publiées (ex. référence chez le fabricant). */
export const INTERNAL_SPEC_KEYS: ReadonlySet<string> = new Set(["manufacturer_reference"]);

/** Caractéristiques publiques : sans les clés internes ni la référence de source. */
export function publicSpecs<T extends Pick<TechnicalSpecValue, "key" | "sourceRef">>(specs: T[]): T[] {
  return specs.filter((s) => !INTERNAL_SPEC_KEYS.has(s.key)).map((s) => ({ ...s, sourceRef: "" }));
}
