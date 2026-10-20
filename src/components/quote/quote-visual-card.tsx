/** Visualisation jointe à un devis (compte client et administration). Image servie par une route à accès contrôlé. */
export interface QuoteVisualView {
  kind: "SCENE_3D" | "PLAN_2D";
  disclaimer: string;
  represented: unknown;
  width: number;
  height: number;
  createdAt: Date;
  configurationVersion?: number | null;
  inputHash?: string;
}

export function QuoteVisualCard({ quoteId, visual, admin = false }: { quoteId: string; visual: QuoteVisualView | null | undefined; admin?: boolean }) {
  if (!visual) return <p data-testid="quote-visual-missing" className="text-sm text-stone-700">Visualisation indisponible pour ce devis : il reste établi sur la base de la configuration enregistrée.</p>;
  const items = Array.isArray(visual.represented) ? (visual.represented as string[]) : [];
  return (
    <figure data-testid="quote-visual" className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- image privée servie sans cache par une route contrôlée */}
      <img src={`/api/devis/${quoteId}/visuel`} alt={`${visual.kind === "SCENE_3D" ? "Visualisation 3D" : "Plan 2D"} non contractuelle du projet`} width={visual.width} height={visual.height} className="w-full h-auto rounded-lg border border-sand-200 bg-sand-100" loading="lazy" />
      <figcaption className="text-xs text-stone-800">
        <span className="font-medium">{visual.kind === "SCENE_3D" ? "Visualisation 3D" : "Plan 2D (la vue 3D n'a pas pu être jointe)"}</span> — {visual.disclaimer}.
        {admin && <span className="block text-stone-700">Figée le {visual.createdAt.toLocaleString("fr-FR")} · configuration {visual.configurationVersion != null ? `v${visual.configurationVersion}` : "non enregistrée ou modifiée depuis"} · empreinte {visual.inputHash?.slice(0, 12)}</span>}
      </figcaption>
      {items.length > 0 && (
        <details className="text-xs text-stone-800">
          <summary className="cursor-pointer">Éléments représentés ({items.length})</summary>
          <ul className="mt-1 list-disc pl-4">{items.map((i) => <li key={i}>{i}</li>)}</ul>
        </details>
      )}
    </figure>
  );
}
