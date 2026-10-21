/**
 * Données publiques des systèmes : le site ne cite ni le fabricant ni le fournisseur (décision client du
 * 2026-10-21). Les sources restent en base et dans l'administration (validation des références) ; elles sont
 * retirées de tout ce qui part vers le navigateur.
 */
import type { SystemRules } from "./system";

/** Noms qui ne doivent apparaître sur aucune page publique (garde-fou des tests). */
export const PUBLIC_FORBIDDEN_NAMES = /aluprof|thysens|\bselt\b|euro[\s-]?confort/i;

/** Copie des règles sans aucune référence de source (listes `sources` vidées). */
export function publicSystemRules(rules: SystemRules): SystemRules {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "sources" ? [] : strip(x)]));
    return v;
  };
  return strip(rules) as SystemRules;
}
