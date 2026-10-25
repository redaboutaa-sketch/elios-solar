"use client";
/**
 * Colonne visuelle des configurateurs : sélecteur « Illustration / Plan 2D / Vue 3D ».
 * three.js n'est chargé qu'au clic sur « Vue 3D » (import dynamique, sans rendu serveur).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Box, Download, Image as ImageIcon, Map as MapIcon } from "lucide-react";
import { buildSceneModel, customSceneBlocker, has3D, representedItems, SCENE_DISCLAIMER, type SceneModel } from "@/domain/scene-model";
import { DRAWING_VIEWS, ProjectDrawing, drawingToPng, envelopeOf, type DrawingView } from "../project-drawing";
import type { AwningInput, CatalogSnapshot, EvaluationResult, PergolaCustomInput, PergolaStandardInput } from "@/domain/types";
import { nearestAllowed, systemSceneBlocker, type SystemInput } from "@/domain/system";

const loading = () => <p className="grid aspect-[4/3] sm:aspect-[16/10] place-items-center rounded-lg bg-sand-100 text-sm text-stone-700">Chargement de la vue 3D…</p>;
const PergolaScene3D = dynamic(() => import("./viewer-3d").then((m) => m.PergolaScene3D), { ssr: false, loading });
const AwningScene3D = dynamic(() => import("./viewer-3d").then((m) => m.AwningScene3D), { ssr: false, loading });

type Mode = "illustration" | "plan" | "3d";

function ModeSwitch({ mode, onChange, withPlan }: { mode: Mode; onChange: (m: Mode) => void; withPlan: boolean }) {
  const items: Array<{ id: Mode; label: string; icon: ReactNode }> = [
    { id: "illustration", label: "Illustration", icon: <ImageIcon className="size-4" aria-hidden="true" /> },
    ...(withPlan ? [{ id: "plan" as const, label: "Plan 2D", icon: <MapIcon className="size-4" aria-hidden="true" /> }] : []),
    { id: "3d", label: "Vue 3D", icon: <Box className="size-4" aria-hidden="true" /> },
  ];
  return (
    <div role="group" aria-label="Mode de visualisation" className="inline-flex rounded-[3px] border border-sand-300 bg-white p-1">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={mode === it.id} data-testid={it.id === "3d" ? "view-3d-toggle" : undefined} onClick={() => onChange(it.id)} className={`inline-flex items-center gap-1.5 rounded-[2px] px-3 py-1.5 text-sm min-h-9 ${mode === it.id ? "bg-anthracite text-sand-50" : "text-stone-800"}`}>
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  );
}

export function PergolaVisuals({ catalog, input, result, art, plan, selectedSegment = null, onSelectSegment, onImage, onCaptureReady }: {
  catalog: CatalogSnapshot;
  /** pergola standard ou sur mesure : même objet que celui envoyé au devis */
  input: PergolaStandardInput | PergolaCustomInput;
  result: EvaluationResult;
  /** illustration existante (affichée aussi si WebGL est indisponible) */
  art: ReactNode;
  /** plan 2D interactif (null si la géométrie est inconnue) */
  plan: ReactNode | null;
  selectedSegment?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  onImage?: (dataUrl: string) => void;
  onCaptureReady?: (capture: (() => Promise<string>) | null) => void;
}) {
  const [mode, setMode] = useState<Mode>("illustration");
  const model = useMemo(() => {
    if (mode !== "3d") return null;
    const m = buildSceneModel(catalog, input, result);
    return m?.kind === "pergola" ? m : null;
  }, [mode, catalog, input, result]);
  return (
    <>
      <ModeSwitch mode={mode} onChange={setMode} withPlan={!!plan} />
      {mode === "illustration" && <div className="card overflow-hidden">{art}</div>}
      {mode === "3d" && (
        <div className="card p-3">
          {model ? <PergolaScene3D model={model} selected={selectedSegment} onSelect={onSelectSegment} onImage={onImage} onCaptureReady={onCaptureReady} fallback={<div className="overflow-hidden rounded-lg">{art}</div>} /> : <p data-testid="scene-3d-blocked" role="status" className="text-sm text-stone-700">{(input.kind === "pergola_custom" && customSceneBlocker(catalog, input)) || "Vue 3D indisponible pour cette configuration (dimension ou gamme inconnue)."}</p>}
        </div>
      )}
      {plan && <div className="card p-3">{plan}</div>}
    </>
  );
}

export function AwningVisuals({ catalog, input, art, onImage, onCaptureReady }: { catalog: CatalogSnapshot; input: AwningInput; art: ReactNode; onImage?: (dataUrl: string) => void; onCaptureReady?: (capture: (() => Promise<string>) | null) => void }) {
  const [mode, setMode] = useState<Mode>("illustration");
  const model = useMemo(() => {
    if (mode !== "3d") return null;
    const m = buildSceneModel(catalog, input);
    return m?.kind === "awning" ? m : null;
  }, [mode, catalog, input]);
  return (
    <>
      <ModeSwitch mode={mode} onChange={setMode} withPlan={false} />
      {mode === "illustration" && <div className="card overflow-hidden">{art}</div>}
      {mode === "3d" && model && <div className="card p-3"><AwningScene3D model={model} onImage={onImage} onCaptureReady={onCaptureReady} fallback={<div className="overflow-hidden rounded-lg">{art}</div>} /></div>}
    </>
  );
}

const SystemScene3D = dynamic(() => import("./viewer-3d").then((m) => m.SystemScene3D), { ssr: false, loading });

type ProjectMode = "drawing" | "3d";

/**
 * Colonne visuelle d'un système HELIOSTORES. Deux rubriques distinctes :
 * - « Visualisation de mon projet » : dessin paramétrique 2D (par défaut, sans WebGL) ou vue 3D chargée à la demande,
 *   tous deux construits depuis la même entrée que l'évaluation serveur et le devis ;
 * - « Photos » : galerie d'illustration du produit, qui ne change pas avec les choix (indiqué).
 */
export function SystemVisuals({ catalog, input, result, art, onImage, onCaptureReady, onDrawingReady }: {
  catalog: CatalogSnapshot;
  input: SystemInput;
  result: EvaluationResult;
  art: ReactNode;
  plan?: ReactNode | null;
  onImage?: (dataUrl: string) => void;
  onCaptureReady?: (capture: (() => Promise<string>) | null) => void;
  /** expose le dessin SVG courant (image jointe au devis, export) */
  onDrawingReady?: (get: (() => SVGSVGElement | null) | null) => void;
}) {
  const [tab, setTab] = useState<"project" | "photos">("project");
  const [mode, setMode] = useState<ProjectMode>("drawing");
  const [view, setView] = useState<DrawingView>("three_quarter");
  const [deployment, setDeployment] = useState(100);
  const [bladeAngle, setBladeAngle] = useState(25);
  const [exportState, setExportState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const family = catalog.families.find((f) => f.slug === input.familySlug);
  const rules = family?.systemRules;
  // cote invalide pendant la saisie : le dessin reste affiché sur la valeur admissible la plus proche (signalé)
  const model = useMemo<SceneModel | null>(() => {
    const m = buildSceneModel(catalog, input, result);
    if (m || !rules || input.sizeCode === "custom") return m;
    const d = rules.dims;
    const near = (r: typeof d.width | undefined, v: number | undefined) => (r && v != null && Number.isFinite(v) ? nearestAllowed(r, v) : v);
    const depthMm = near(d.depth, input.depthMm);
    const minW = rules.depthWidthMin?.find((c) => c.depthMm === depthMm)?.widthMinMm ?? 0;
    return buildSceneModel(catalog, { ...input, widthMm: Math.max(minW, near(d.width, input.widthMm) ?? d.width.maxMm), depthMm, heightMm: near(d.height, input.heightMm) }, null);
  }, [catalog, input, result, rules]);
  const blocker = rules ? systemSceneBlocker(rules, input) : "Système inconnu.";
  const svgRef = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    onDrawingReady?.(() => svgRef.current);
    return () => onDrawingReady?.(null);
  }, [onDrawingReady]);
  const can3d = !!model && has3D(model);
  const envelope = model && rules ? envelopeOf(model, { widthMm: rules.dims.width.maxMm, depthMm: rules.dims.depth?.maxMm, heightMm: rules.dims.height?.maxMm }) : null;
  const movable = model ? (model.kind === "pergola" ? (model.roof === "fabric" ? null : "blades") : model.kind === "insect" && model.opening === "fixed" || model.kind === "insect" && model.opening === "hinged" ? null : "fabric") : null;
  const exportDrawing = async () => {
    if (!svgRef.current || !model) return;
    setExportState("busy");
    try {
      const { composeProjectImage, captionOf, downloadDataUrl } = await import("./export-image");
      const png = await composeProjectImage(await drawingToPng(svgRef.current), captionOf(model));
      downloadDataUrl(png);
      onImage?.(png);
      setExportState("done");
    } catch {
      setExportState("error");
    }
  };
  const tabBtn = (id: "project" | "photos", label: string) => (
    <button type="button" role="tab" id={`vis-tab-${id}`} aria-selected={tab === id} aria-controls={`vis-panel-${id}`} onClick={() => setTab(id)} className={`min-h-10 border-b-2 px-3 text-sm font-medium ${tab === id ? "border-brand-700 text-ink" : "border-transparent text-stone-700 hover:text-ink"}`} data-testid={`vis-tab-${id}`}>{label}</button>
  );
  return (
    <div className="space-y-3" data-testid="system-visuals">
      <div role="tablist" aria-label="Visuels" className="flex gap-1 border-b border-sand-200">
        {tabBtn("project", "Visualisation de mon projet")}
        {tabBtn("photos", "Photos")}
      </div>
      <div role="tabpanel" id="vis-panel-project" aria-labelledby="vis-tab-project" hidden={tab !== "project"} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Rendu" className="inline-flex rounded-[3px] border border-sand-300 bg-white p-1">
            <button type="button" aria-pressed={mode === "drawing"} onClick={() => setMode("drawing")} className={`inline-flex min-h-9 items-center gap-1.5 rounded-[2px] px-3 text-sm ${mode === "drawing" ? "bg-anthracite text-sand-50" : "text-stone-800"}`} data-testid="view-drawing-toggle"><MapIcon className="size-4" aria-hidden="true" />Dessin</button>
            <button type="button" aria-pressed={mode === "3d"} disabled={!can3d} title={can3d ? undefined : "Vue 3D non disponible pour ce produit : le dessin reste à jour."} onClick={() => setMode("3d")} className={`inline-flex min-h-9 items-center gap-1.5 rounded-[2px] px-3 text-sm disabled:opacity-50 ${mode === "3d" ? "bg-anthracite text-sand-50" : "text-stone-800"}`} data-testid="view-3d-toggle"><Box className="size-4" aria-hidden="true" />Vue 3D</button>
          </div>
          {mode === "drawing" && (
            <div role="group" aria-label="Vues du dessin" className="flex flex-wrap gap-1">
              {DRAWING_VIEWS.map((v) => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`min-h-9 rounded-[2px] border px-3 text-xs ${view === v.id ? "border-ink bg-anthracite text-sand-50" : "border-sand-300 bg-white"}`}>{v.label}</button>)}
            </div>
          )}
        </div>
        {blocker && <p role="status" data-testid="scene-3d-blocked" className="rounded-lg border border-warning/40 bg-white p-2 text-xs text-stone-800">{blocker.replace("Vue 3D indisponible", "Visualisation figée sur la dernière cote valide")}</p>}
        <div className={mode === "drawing" ? "card overflow-hidden" : "hidden"}>
          {model && envelope ? <ProjectDrawing ref={svgRef} model={model} view={view} deployment={deployment / 100} bladeAngle={bladeAngle} envelope={envelope} /> : <p className="grid aspect-[16/10] place-items-center p-4 text-sm text-stone-700">Saisissez des cotes dans la plage proposée pour afficher votre projet.</p>}
        </div>
        {mode === "drawing" && model && (
          <>
            {movable === "blades" ? (
              <label className="flex items-center gap-3 text-xs text-stone-800"><span className="whitespace-nowrap">Ouverture des lames</span><input type="range" min={0} max={model.kind === "pergola" ? model.blades.maxAngleDeg ?? 90 : 90} value={bladeAngle} onChange={(e) => setBladeAngle(Number(e.target.value))} className="flex-1 accent-brand-600" aria-valuetext={`${bladeAngle} degrés`} /><span className="w-10 text-right tabular-nums">{bladeAngle}°</span></label>
            ) : movable ? (
              <label className="flex items-center gap-3 text-xs text-stone-800"><span className="whitespace-nowrap">{model.kind === "insect" ? "Position de la toile" : model.kind === "awning" ? "Déploiement de la toile" : "Descente de la toile"}</span><input type="range" min={0} max={100} value={deployment} onChange={(e) => setDeployment(Number(e.target.value))} className="flex-1 accent-brand-600" aria-valuetext={`${deployment} %`} /><span className="w-10 text-right tabular-nums">{deployment} %</span></label>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary py-1.5 text-sm" onClick={exportDrawing} disabled={exportState === "busy"} data-testid="export-drawing"><Download className="size-4" aria-hidden="true" /> Exporter l'image du projet</button>
              <span aria-live="polite" className="text-xs text-stone-700">{exportState === "done" ? "Image exportée." : exportState === "error" ? "Export impossible sur ce navigateur." : ""}</span>
            </div>
            <ul className="list-disc pl-5 text-xs text-stone-700" data-testid="represented-items">{representedItems(catalog, model).map((t) => <li key={t}>{t}</li>)}</ul>
          </>
        )}
        {mode === "3d" && can3d && model && has3D(model) && (
          <div className="card p-3"><SystemScene3D model={model} onImage={onImage} onCaptureReady={onCaptureReady} fallback={null} /></div>
        )}
        <p className="text-xs text-stone-700">{SCENE_DISCLAIMER} : proportions selon vos cotes, sections et teintes indicatives. Les réglages d'affichage ne modifient ni la configuration ni le prix.</p>
      </div>
      <div role="tabpanel" id="vis-panel-photos" aria-labelledby="vis-tab-photos" hidden={tab !== "photos"} className="space-y-2">
        <div className="card overflow-hidden">{art}</div>
        <p className="text-xs text-stone-700" data-testid="photos-note">Photos d'illustration du produit : elles ne changent pas avec vos choix. Votre configuration est représentée dans « Visualisation de mon projet ».</p>
      </div>
    </div>
  );
}
