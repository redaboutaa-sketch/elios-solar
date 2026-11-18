"use client";
/**
 * Aperçu de la visualisation 3D du configurateur sur l'accueil : le modèle de scène est calculé côté serveur pour la
 * configuration par défaut ; three.js n'est chargé qu'au clic (import dynamique, sans rendu serveur).
 */
import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Box } from "lucide-react";
import type { SceneModel } from "@/domain/scene-model";
import { has3D } from "@/domain/scene-model";
import { useT } from "@/i18n/client";

function Loading3D() {
  const t = useT("home");
  return <p className="grid aspect-[16/10] place-items-center bg-sand-100 text-sm text-stone-700">{t.scene.loading3d}</p>;
}

const SystemScene3D = dynamic(() => import("@/components/configurator/scene-3d/viewer-3d").then((m) => m.SystemScene3D), { ssr: false, loading: () => <Loading3D /> });

export function ScenePreview({ model, poster }: { model: SceneModel; poster: ReactNode }) {
  const t = useT("home");
  const [on, setOn] = useState(false);
  return on && has3D(model) ? (
    <div className="border border-sand-200 bg-white p-3" data-testid="home-scene-3d"><SystemScene3D model={model} fallback={poster} /></div>
  ) : (
    <div className="relative border border-sand-200 bg-white">
      {poster}
      <button type="button" onClick={() => setOn(true)} className="btn-accent absolute bottom-4 left-4" data-testid="home-scene-3d-load"><Box className="size-4" aria-hidden="true" /> {t.scene.show3d}</button>
    </div>
  );
}
