"use client";
/**
 * Colonne visuelle des configurateurs : sélecteur « Illustration / Plan 2D / Vue 3D ».
 * three.js n'est chargé qu'au clic sur « Vue 3D » (import dynamique, sans rendu serveur).
 */
import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Box, Image as ImageIcon, Map as MapIcon } from "lucide-react";
import { buildSceneModel } from "@/domain/scene-model";
import type { AwningInput, CatalogSnapshot, EvaluationResult, PergolaStandardInput } from "@/domain/types";

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
    <div role="group" aria-label="Mode de visualisation" className="inline-flex rounded-full border border-sand-300 bg-white p-1">
      {items.map((it) => (
        <button key={it.id} type="button" aria-pressed={mode === it.id} data-testid={it.id === "3d" ? "view-3d-toggle" : undefined} onClick={() => onChange(it.id)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm min-h-9 ${mode === it.id ? "bg-anthracite text-sand-50" : "text-stone-800"}`}>
          {it.icon}{it.label}
        </button>
      ))}
    </div>
  );
}

export function PergolaVisuals({ catalog, input, result, art, plan, selectedSegment = null, onSelectSegment, onImage }: {
  catalog: CatalogSnapshot;
  input: PergolaStandardInput;
  result: EvaluationResult;
  /** illustration existante (affichée aussi si WebGL est indisponible) */
  art: ReactNode;
  /** plan 2D interactif (null si la géométrie est inconnue) */
  plan: ReactNode | null;
  selectedSegment?: string | null;
  onSelectSegment?: (segmentId: string) => void;
  onImage?: (dataUrl: string) => void;
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
          {model ? <PergolaScene3D model={model} selected={selectedSegment} onSelect={onSelectSegment} onImage={onImage} fallback={<div className="overflow-hidden rounded-lg">{art}</div>} /> : <p className="text-sm text-stone-700">Vue 3D indisponible pour cette configuration (dimension ou gamme inconnue).</p>}
        </div>
      )}
      {plan && <div className="card p-3">{plan}</div>}
    </>
  );
}

export function AwningVisuals({ catalog, input, art, onImage }: { catalog: CatalogSnapshot; input: AwningInput; art: ReactNode; onImage?: (dataUrl: string) => void }) {
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
      {mode === "3d" && model && <div className="card p-3"><AwningScene3D model={model} onImage={onImage} fallback={<div className="overflow-hidden rounded-lg">{art}</div>} /></div>}
    </>
  );
}
