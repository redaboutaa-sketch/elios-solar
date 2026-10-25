/**
 * Rendu hors écran d'un modèle de scène, pour joindre une visualisation à un devis
 * lorsque l'utilisateur n'a pas ouvert la vue 3D. Chargé à la demande (three.js).
 * Lève une erreur si WebGL est indisponible : l'appelant se replie alors sur le plan 2D côté serveur.
 */
import type { Scene3DModel } from "@/domain/scene-model";
import { SceneEngine } from "./scene-engine";
import { buildScene } from "./build-scene";
import { captionOf, composeProjectImage } from "./export-image";

export async function renderModelOffscreen(model: Scene3DModel, width = 1280, height = 800): Promise<string> {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;pointer-events:none;`;
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);
  let engine: SceneEngine | null = null;
  try {
    engine = new SceneEngine(canvas, container);
    engine.setBuilt(buildScene(model));
    engine.setView("three_quarter", false);
    const raw = engine.capture();
    return await composeProjectImage(raw, captionOf(model));
  } finally {
    engine?.dispose();
    container.remove();
  }
}
