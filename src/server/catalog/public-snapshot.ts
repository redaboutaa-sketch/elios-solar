import "server-only";
import type { CatalogSnapshot } from "@/domain/types";
import { loadCatalog } from "@/server/catalog/load";

/**
 * Instantané public du catalogue pour le configurateur côté client (aperçu immédiat).
 * Le prix affiché est toujours confirmé par l'action serveur `evaluateAction` et
 * recalculé au panier et à la commande : le navigateur n'est jamais autoritaire.
 */
export async function ensureCatalogSnapshot(): Promise<CatalogSnapshot> {
  const c = await loadCatalog();
  return { ...c, variants: c.variants.map((v) => ({ ...v, stockQty: undefined, weightGrams: undefined })) };
}
