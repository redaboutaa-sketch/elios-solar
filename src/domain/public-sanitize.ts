/**
 * Données publiques des systèmes : le site ne cite ni le fabricant, ni le fournisseur, ni ses références
 * (décisions client des 2026-10-21 et 2026-10-22 : nomenclature commerciale HELIOSTORES). Les sources et les
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
  /aluprof|thysens|\bselt\b|euro[\s-]?confort|\bsb\s?[45][05]0\b|refleksol|zi{2,}p|\bzip\s?120\b|casablanca|veranda\s?fts|\bfts\b|sunbreaker|zoomtech|blebox|elero|somfy|picolo|\baltus\b|sunilus|suntop|varieco|\bdm45|corsica|palladio|tahoma|eolis|soliris|ondeis/i;

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
