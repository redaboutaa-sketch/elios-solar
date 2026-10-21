import "server-only";
import { evaluate } from "@/domain/engine";
import { buildSceneModel, type SceneModel } from "@/domain/scene-model";
import { defaultSystemInput, type SystemInput, type SystemRules } from "@/domain/system";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";

/**
 * Modèle de scène 3D de la configuration par défaut d'un système (mêmes fonctions pures que le configurateur), pour un
 * aperçu chargé à la demande sur l'accueil et les fiches. Seul ce modèle (données) part au navigateur.
 */
export async function defaultSceneModel(familySlug: string): Promise<SceneModel | null> {
  const catalog = await ensureCatalogSnapshot();
  const fam = catalog.families.find((x) => x.slug === familySlug && x.systemRules);
  if (!fam) return null;
  const input: SystemInput = { ...defaultSystemInput(fam.slug, fam.systemRules as SystemRules), kind: "system", familySlug: fam.slug };
  return buildSceneModel(catalog, input, evaluate(catalog, input));
}
