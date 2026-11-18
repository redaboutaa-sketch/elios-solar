"use client";
/**
 * Vue 3D interactive (three.js). Chargée uniquement à la demande via `next/dynamic` (voir `visuals.tsx`).
 * Les réglages de visualisation (lames, déploiement, nuit, vues) sont un état local : ils ne
 * modifient jamais la configuration (`input`) ni le prix.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import type { AwningSceneModel, PergolaSceneModel, Scene3DModel as SceneModel, ScreenSceneModel } from "@/domain/scene-model";
import { SIDE_LABELS } from "@/domain/layout";
import { SceneEngine, VIEW_PRESETS, supportsWebGL, type ViewPreset } from "./scene-engine";
import { buildScene } from "./build-scene";
import { captionOf, composeProjectImage, downloadDataUrl, EXPORT_FILENAME } from "./export-image";

const UNAVAILABLE = "La vue 3D n'est pas disponible sur cet appareil (WebGL désactivé ou non pris en charge). L'illustration et le plan 2D restent disponibles et le configurateur reste entièrement utilisable.";

const CLOSURE_NAMES: Record<string, string> = { glass: "paroi vitrée", slats: "persienne", screen: "store ZIP" };

function describe(model: SceneModel): string {
  if (model.kind === "screen") {
    return `${model.familyName} ${model.dimensionLabel} (largeur × hauteur), pose ${model.mounting === "niche" ? "en niche" : "en façade"}, structure ${model.finishLabel}, toile ${model.fabric.label}, ${model.control}.`;
  }
  if (model.kind === "awning") {
    return `${model.familyName} ${model.dimensionLabel} (largeur × avancée), ${model.finishLabel}, ${model.bracketCount} supports ${model.bracketMount === "wall" ? "muraux" : model.bracketMount === "rafter" ? "sur chevrons" : "plafond"}${model.control ? `, commande ${model.control === "manual" ? "manuelle" : "électrique"}` : ""}${model.led ? ", LED sous le coffre" : ""}${model.ledArms ? ", LED dans les bras" : ""}${model.anemometer ? ", capteur de vent" : ""}.`;
  }
  const closures = model.closures.map((c) => `${CLOSURE_NAMES[c.type]} ${SIDE_LABELS[c.side].toLowerCase()}${model.openings.filter((o) => o.side === c.side).length > 1 ? ` ${c.index}` : ""}${c.assembly.kind === "modular" ? ` (${c.assembly.modules} modules${c.assembly.toConfirm ? ", assemblage à confirmer" : ""})` : ""}`);
  const light = [model.lighting.blades ? "LED intégrées aux lames" : model.lighting.gutter ? `LED ${model.sections ? "périphérique" : "de gouttière"} ${model.lighting.color === "rgb" ? "RGB" : "blanc chaud"}` : null, model.lighting.spots ? `${model.lighting.spots} spots LED` : null].filter(Boolean).join(", ") || "sans éclairage";
  return [
    `${model.familyName} ${model.dimensionLabel}, ${model.mounting === "wall" ? "adossée au mur" : "autoportante"}, ${model.sections ? model.finishLabel : model.finishLabel.toLowerCase()}`,
    model.roof === "fabric" ? `${model.posts.length} poteaux, toiture en toile` : `${model.posts.length} poteaux, ${model.blades.count} lames (indicatif)`,
    closures.length ? closures.join(", ") : "aucune fermeture",
    light,
    model.heaters.count ? `${model.heaters.count} lampe${model.heaters.count > 1 ? "s" : ""} chauffante${model.heaters.count > 1 ? "s" : ""}` : null,
    model.lanterns.count ? `${model.lanterns.count} lanterne${model.lanterns.count > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(" · ");
}

function frameKeyOf(model: SceneModel): string {
  if (model.kind === "pergola") return `p-${model.lengthMm}-${model.widthMm}-${model.mounting}`;
  if (model.kind === "screen") return `s-${model.widthMm}-${model.heightMm}-${model.mounting}`;
  return `a-${model.widthMm}-${model.projectionMm}-${model.bracketMount}`;
}

interface ViewerProps {
  model: SceneModel;
  selected?: string | null;
  onSelect?: (segmentId: string) => void;
  /** reçoit le dataURL PNG de l'image du projet après export (ex. pour le joindre à un devis) */
  onImage?: (dataUrl: string) => void;
  /** contenu affiché si WebGL est indisponible */
  fallback?: ReactNode;
  /** expose une capture de la vue courante (sans téléchargement), ex. pour la joindre à un devis ; null au démontage */
  onCaptureReady?: (capture: (() => Promise<string>) | null) => void;
}

function Viewer3D({ model, selected = null, onSelect, onImage, fallback, onCaptureReady }: ViewerProps) {
  const [failed, setFailed] = useState(() => !supportsWebGL());
  const [engine, setEngine] = useState<SceneEngine | null>(null);
  const [view, setView] = useState<ViewPreset>("three_quarter");
  const [bladeAngle, setBladeAngle] = useState(0);
  const [deployment, setDeployment] = useState(100);
  const [exportState, setExportState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const framed = useRef(false);

  // Le canvas est créé ici (un canvas neuf par montage) pour pouvoir libérer le contexte WebGL au démontage.
  const containerRef = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    const canvas = document.createElement("canvas");
    canvas.className = "block size-full touch-none";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Vue 3D indicative du projet");
    container.appendChild(canvas);
    let instance: SceneEngine;
    try {
      instance = new SceneEngine(canvas, container);
    } catch {
      canvas.remove();
      setFailed(true);
      return;
    }
    const onLost = (e: Event) => { e.preventDefault(); setFailed(true); };
    canvas.addEventListener("webglcontextlost", onLost);
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(container);
    setEngine(instance);
    return () => {
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      instance.dispose();
      canvas.remove();
      framed.current = false;
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    engine.setBuilt(buildScene(model));
  }, [engine, model]);
  useEffect(() => { engine?.current?.setBladeAngle?.(bladeAngle); engine?.invalidate(); }, [engine, model, bladeAngle]);
  useEffect(() => { engine?.current?.setDeployment?.(deployment / 100); engine?.invalidate(); }, [engine, model, deployment]);
  useEffect(() => { engine?.current?.setSelected?.(selected); engine?.invalidate(); }, [engine, model, selected]);
  // ambiance nuit retirée : rendu de jour, éclairages choisis représentés allumés (voir builders)
  useEffect(() => { engine?.setNight(false); }, [engine, model]);
  const frameKey = frameKeyOf(model);
  useEffect(() => {
    if (!engine || !frameKey) return;
    engine.setView(view, framed.current);
    framed.current = true;
  }, [engine, frameKey, view]);

  useEffect(() => {
    if (!onCaptureReady) return;
    onCaptureReady(engine ? () => composeProjectImage(engine.capture(), captionOf(model)) : null);
    return () => onCaptureReady(null);
  }, [engine, model, onCaptureReady]);

  const exportImage = async () => {
    if (!engine) return;
    setExportState("busy");
    try {
      const raw = engine.capture();
      const dataUrl = await composeProjectImage(raw, captionOf(model));
      downloadDataUrl(dataUrl, EXPORT_FILENAME);
      onImage?.(dataUrl);
      setExportState("done");
    } catch {
      setExportState("error");
    }
  };

  const description = describe(model);

  if (failed) {
    return (
      <div data-testid="scene-3d" className="space-y-3">
        <p data-testid="scene-3d-unavailable" role="status" className="rounded-lg border border-warning/40 bg-white p-3 text-sm text-stone-800">{UNAVAILABLE}</p>
        {fallback}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        data-testid="scene-3d"
        className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden rounded-lg bg-sand-100"
        aria-describedby="scene-3d-description"
        onPointerDown={(e) => { pointer.current = { x: e.clientX, y: e.clientY }; }}
        onPointerUp={(e) => {
          const start = pointer.current;
          pointer.current = null;
          if (!start || !engine || !onSelect || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) return;
          const id = engine.pick(e.clientX, e.clientY);
          if (id) onSelect(id);
        }}
      >
        {!engine && <p className="absolute inset-0 grid place-items-center text-sm text-stone-700">Préparation de la vue 3D…</p>}
      </div>
      <p id="scene-3d-description" className="text-xs text-stone-700">{description}</p>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Vues prédéfinies" className="flex flex-wrap gap-1">
          {VIEW_PRESETS.map((p) => (
            <button key={p.id} type="button" aria-pressed={view === p.id} onClick={() => { setView(p.id); if (view === p.id) engine?.setView(p.id); }} className={`rounded-[2px] border px-3 py-1.5 text-xs min-h-9 ${view === p.id ? "border-ink bg-anthracite text-sand-50" : "border-sand-300 bg-white"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {model.kind === "pergola" && model.roof !== "fabric" ? (
        <label className="flex items-center gap-3 text-xs text-stone-800">
          <span className="whitespace-nowrap">Ouverture des lames</span>
          <input type="range" min={0} max={model.blades.maxAngleDeg ?? 90} step={1} value={bladeAngle} onChange={(e) => setBladeAngle(Number(e.target.value))} className="flex-1 accent-brand-600" aria-valuetext={`${bladeAngle} degrés`} />
          <span className="w-10 text-right tabular-nums">{bladeAngle}°</span>
        </label>
      ) : model.kind !== "pergola" ? (
        <label className="flex items-center gap-3 text-xs text-stone-800">
          <span className="whitespace-nowrap">{model.kind === "screen" ? "Descente de la toile" : "Déploiement de la toile"}</span>
          <input type="range" min={0} max={100} step={1} value={deployment} onChange={(e) => setDeployment(Number(e.target.value))} className="flex-1 accent-brand-600" aria-valuetext={`${deployment} %`} />
          <span className="w-10 text-right tabular-nums">{deployment} %</span>
        </label>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary py-1.5 text-sm" onClick={exportImage} disabled={!engine || exportState === "busy"}><Download className="size-4" aria-hidden="true" /> Exporter l'image du projet</button>
        <span aria-live="polite" className="text-xs text-stone-700">{exportState === "done" ? "Image exportée." : exportState === "error" ? "Export impossible sur ce navigateur." : ""}</span>
      </div>
      <p className="text-xs text-stone-700">Faites glisser pour tourner, molette ou pincement pour zoomer{onSelect ? ", touchez une ouverture pour l'équiper" : ""}. Réglages d'affichage uniquement : ils ne modifient ni la configuration ni le prix.</p>
      {(model.kind === "awning" ? model.toConfirm ?? [] : model.toConfirm).length > 0 && (
        <div data-testid="scene-3d-to-confirm" className="rounded-lg border border-warning/40 bg-white p-3 text-xs text-stone-800">
          <p className="font-medium">Représenté à titre indicatif, à confirmer sur devis :</p>
          <ul className="mt-1 list-disc pl-4">{(model.kind === "awning" ? model.toConfirm ?? [] : model.toConfirm).map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      )}
      <p className="text-xs font-medium text-stone-800">{model.disclaimer} — {model.kind === "screen" ? `cotes saisies, coffre selon le catalogue, teinte de toile indicative.` : model.kind === "pergola" && !model.indicative.heightMm ? `hauteur saisie (${(model.heightMm / 1000).toLocaleString("fr-FR")} m), ${model.sections ? "sections du catalogue" : "sections indicatives"}.` : `hauteur (${(model.heightMm / 1000).toLocaleString("fr-FR")} m) et sections indicatives.`}</p>
    </div>
  );
}

export function PergolaScene3D(props: Omit<ViewerProps, "model"> & { model: PergolaSceneModel }) {
  return <Viewer3D {...props} />;
}

export function SystemScene3D(props: Omit<ViewerProps, "model"> & { model: SceneModel }) {
  return <Viewer3D {...props} />;
}

export function ScreenScene3D(props: Omit<ViewerProps, "model" | "selected" | "onSelect"> & { model: ScreenSceneModel }) {
  return <Viewer3D {...props} />;
}

export function AwningScene3D(props: Omit<ViewerProps, "model" | "selected" | "onSelect"> & { model: AwningSceneModel }) {
  return <Viewer3D {...props} />;
}
