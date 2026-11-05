import "server-only";
import type { CatalogSnapshot } from "@/domain/types";
import { loadCatalog } from "@/server/catalog/load";
import { publicSpecs, publicSystemRules } from "@/domain/public-sanitize";

/**
 * Instantané public du catalogue pour le configurateur côté client (aperçu immédiat).
 * Le prix affiché est toujours confirmé par l'action serveur `evaluateAction` et
 * recalculé au panier et à la commande : le navigateur n'est jamais autoritaire.
 * Les systèmes y figurent sans fabricant, marque, référence fournisseur ni source (données internes à l'administration).
 */
export async function ensureCatalogSnapshot(): Promise<CatalogSnapshot> {
  const c = await loadCatalog();
  return {
    ...c,
    families: c.families.map((f) => (f.systemRules ? { ...f, brand: null, manufacturer: null, supplierRef: null, systemRules: publicSystemRules(f.systemRules), technicalSpecs: f.technicalSpecs && publicSpecs(f.technicalSpecs) } : f)),
    variants: c.variants.map((v) => ({ ...v, stockQty: undefined, weightGrams: undefined })),
  };
}
