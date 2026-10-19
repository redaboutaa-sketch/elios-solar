"use client";
/**
 * Visualisation jointe à une demande de devis :
 * 1. l'image exportée par l'utilisateur, si elle correspond à la configuration courante ;
 * 2. sinon une capture de la vue 3D ouverte ;
 * 3. sinon un rendu hors écran (three.js chargé à la demande).
 * En cas d'échec (WebGL absent, rendu impossible), `null` : le serveur joint alors un plan 2D ou l'indique.
 */
import { useCallback, useRef } from "react";
import { buildSceneModel } from "@/domain/scene-model";
import type { CatalogSnapshot, ConfigurationInput, EvaluationResult } from "@/domain/types";

export function useQuoteVisual(catalog: CatalogSnapshot, input: ConfigurationInput, result: Pick<EvaluationResult, "layout"> | null) {
  const key = JSON.stringify(input);
  const lastExport = useRef<{ dataUrl: string; key: string } | null>(null);
  const capture = useRef<(() => Promise<string>) | null>(null);

  const onImage = useCallback((dataUrl: string) => { lastExport.current = { dataUrl, key }; }, [key]);
  const onCaptureReady = useCallback((fn: (() => Promise<string>) | null) => { capture.current = fn; }, []);

  const getVisual = useCallback(async (): Promise<string | null> => {
    let raw: string | null = null;
    if (lastExport.current?.key === key) raw = lastExport.current.dataUrl;
    else if (capture.current) raw = await capture.current();
    else {
      const model = buildSceneModel(catalog, input, result);
      if (!model) return null;
      const { renderModelOffscreen } = await import("./scene-3d/offscreen-capture");
      raw = await renderModelOffscreen(model);
    }
    const { toUploadJpeg } = await import("./scene-3d/export-image");
    return toUploadJpeg(raw);
  }, [catalog, input, result, key]);

  return { onImage, onCaptureReady, getVisual };
}
