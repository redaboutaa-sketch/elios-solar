/** Aiguillage unique modèle de scène → géométrie three.js (vue interactive et capture hors écran). */
import type { SceneModel } from "@/domain/scene-model";
import type { BuiltScene } from "./scene-engine";
import { buildPergolaScene } from "./pergola-builder";
import { buildAwningScene } from "./awning-builder";
import { buildScreenScene } from "./screen-builder";

export function buildScene(model: SceneModel): BuiltScene {
  if (model.kind === "pergola") return buildPergolaScene(model);
  if (model.kind === "screen") return buildScreenScene(model);
  return buildAwningScene(model);
}
