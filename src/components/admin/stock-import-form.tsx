"use client";
import { useActionState } from "react";
import { applyStockImportAction, previewStockImportAction, type StockPreviewState } from "@/server/actions/admin/stock";

type State = StockPreviewState | null;

export function StockImportForm() {
  const [state, action, pending] = useActionState<State, FormData>(previewStockImportAction, null);
  const ok = state && "preview" in state ? state : null;
  const preview = ok?.preview ?? null;
  return (
    <div className="space-y-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="stock-file">Fichier CSV ou JSON</label><input id="stock-file" name="file" type="file" accept=".csv,.json,text/csv,application/json" required className="input" /></div>
        <button className="btn-secondary" type="submit" disabled={pending}>Aperçu</button>
        <a className="text-sm underline" href="https://github.com/redaboutaa-sketch/elios-solar/blob/feat/storefront-configurator/docs/import/stocks.example.csv">Modèle de fichier</a>
      </form>
      {state && "error" in state && state.error && <p className="text-sm text-danger" role="alert">{state.error}</p>}
      {preview && (
        <div className="space-y-3" data-testid="stock-preview">
          <p className="text-sm">{preview.rows.length} ligne(s) valide(s) · {preview.errors.length} rejetée(s){preview.duplicates.length ? ` · doublons : ${preview.duplicates.join(", ")}` : ""}</p>
          {preview.errors.length > 0 && <ul className="text-sm text-danger list-disc pl-5">{preview.errors.slice(0, 50).map((e, i) => <li key={i}>Ligne {e.line}{e.sku ? ` (${e.sku})` : ""} : {e.message}</li>)}</ul>}
          <ul className="text-sm space-y-1">{preview.rows.slice(0, 200).map((r) => <li key={r.row.sku}><span className="font-mono">{r.row.sku}</span> : {r.changes.length ? r.changes.join(" · ") : "aucun changement"}{r.warnings.map((w) => <span key={w} className="block text-warning">⚠ {w}</span>)}</li>)}</ul>
          {preview.rows.length > 0 && ok && (
            <form action={applyStockImportAction}>
              <input type="hidden" name="text" value={ok.text} />
              <input type="hidden" name="filename" value={ok.filename} />
              <button className="btn-primary" type="submit">Appliquer les {preview.rows.length} ligne(s) valide(s)</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
