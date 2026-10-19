"use client";
import { useActionState } from "react";
import { importGridAction, previewGridAction, testGridAction, type GridPreviewState, type GridTestState } from "@/server/actions/admin/grids";

const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
type PreviewState = GridPreviewState | null;
type TestState = GridTestState | null;

export function GridImportForm() {
  const [state, action, pending] = useActionState<PreviewState, FormData>(previewGridAction, null);
  const ok = state && "summary" in state ? state : null;
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="grid-file">Grille fournisseur (JSON ou CSV)</label><input id="grid-file" name="file" type="file" required accept=".json,.csv,application/json,text/csv" className="input" /></div>
        <button className="btn-secondary" type="submit" disabled={pending}>Aperçu et validation</button>
      </form>
      {state && "error" in state && state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {ok && (
        <div className="space-y-2 text-sm" data-testid="grid-preview">
          <p>{ok.summary.name} · famille {ok.summary.familySlug} · {ok.summary.cells} cellules · {ok.summary.surcharges} suppléments · prix {eur(ok.summary.priceRange[0])} à {eur(ok.summary.priceRange[1])} · couverture {(ok.validation.coverage * 100).toFixed(0)} %</p>
          {ok.validation.errors.map((e, i) => <p key={`e${i}`} className="text-danger">✗ {e.message}</p>)}
          {ok.validation.warnings.map((w, i) => <p key={`w${i}`} className="text-warning">⚠ {w.message}</p>)}
          {ok.validation.gaps.length > 0 && <details><summary>Zones sans tarif (devis)</summary><ul className="list-disc pl-5">{ok.validation.gaps.map((g, i) => <li key={i}>{g.mounting} / {g.finishCode} : largeur {g.widthMm.join("–")} mm × longueur {g.lengthMm.join("–")} mm</li>)}</ul></details>}
          {ok.validation.errors.length === 0 ? (
            <form action={importGridAction}><input type="hidden" name="text" value={ok.text} /><input type="hidden" name="filename" value={ok.filename} /><button className="btn-primary" type="submit">Importer en brouillon</button></form>
          ) : <p className="text-danger">Corrigez les erreurs avant import.</p>}
        </div>
      )}
    </div>
  );
}

export function GridTestForm({ gridId, finishCodes }: { gridId: string; finishCodes: string[] }) {
  const [state, action, pending] = useActionState<TestState, FormData>(testGridAction, null);
  const r = state && "result" in state ? state.result : null;
  return (
    <div className="space-y-2">
      <form action={action} className="grid gap-2 sm:grid-cols-7 items-end text-sm">
        <input type="hidden" name="id" value={gridId} />
        <div><label className="label" htmlFor="t-w">Largeur mm</label><input id="t-w" name="widthMm" type="number" defaultValue={3200} className="input" /></div>
        <div><label className="label" htmlFor="t-l">Longueur mm</label><input id="t-l" name="lengthMm" type="number" defaultValue={4500} className="input" /></div>
        <div><label className="label" htmlFor="t-h">Hauteur mm</label><input id="t-h" name="heightMm" type="number" defaultValue={2500} className="input" /></div>
        <div><label className="label" htmlFor="t-m">Implantation</label><select id="t-m" name="mounting" className="input"><option value="freestanding">autoportée</option><option value="wall">adossée</option></select></div>
        <div><label className="label" htmlFor="t-f">Finition</label><select id="t-f" name="finishCode" className="input">{(finishCodes.length ? finishCodes : ["ANTHRACITE"]).map((f) => <option key={f}>{f}</option>)}</select></div>
        <div><label className="label" htmlFor="t-c">Fermetures (slugs)</label><input id="t-c" name="closures" placeholder="paroi-vitree" className="input" /></div>
        <button className="btn-secondary" type="submit" disabled={pending}>Tester</button>
      </form>
      {r && (r.status === "priced" ? (
        <div className="text-sm" data-testid="grid-test-result"><p className="font-medium">Prix calculé : {eur(r.totalCents)} (cellule {r.cell.widthMinMm}–{r.cell.widthMaxMm} × {r.cell.lengthMinMm}–{r.cell.lengthMaxMm} : {eur(r.baseCents)})</p><ul className="list-disc pl-5">{r.lines.map((l) => <li key={l.code}>{l.label}{l.qty > 1 ? ` × ${l.qty}` : ""} : {eur(l.cents * l.qty)}</li>)}</ul>{r.unpriced.length > 0 && <p className="text-warning">Non tarifé (devis) : {r.unpriced.join(", ")}</p>}</div>
      ) : <p className="text-sm text-warning" data-testid="grid-test-result">Pas de prix : {r.message}</p>)}
      {state && "error" in state && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
