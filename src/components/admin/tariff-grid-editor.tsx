"use client";
/**
 * Éditeur matriciel d'une grille tarifaire (administrateurs) : saisie directe d'une ou plusieurs cellules, sélection
 * par ligne ou colonne, actions groupées, ajout de dimensions. Seules les modifications sont envoyées ; le serveur
 * revalide chaque montant (aucun calcul de prix n'est accepté du navigateur).
 *
 * États : montant (tarifée), « 0,00 » (prix nul), vide (à renseigner), « — » (combinaison non tarifée : devis).
 */
import { useMemo, useState } from "react";

export interface EditorCell {
  dimAmm: number;
  widthMinMm: number;
  widthMaxMm: number;
  amountMinor: number | null;
  sourceRef: string;
  origin: string;
  editedBy: string | null;
  editedAt: string | null;
  status: string;
  issues: string[];
  formula: string | null;
}

type Val = { kind: "value"; text: string } | { kind: "absent" };

const key = (d: number, w0: number, w1: number) => `${d}|${w0}|${w1}`;
const toText = (minor: number | null) => (minor == null ? "" : `${Math.trunc(minor / 100)},${String(minor % 100).padStart(2, "0")}`);
const fmtM = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}`;
const fmtW = (a: number, b: number) => (a === b ? fmtM(b) : `${fmtM(a)}–${fmtM(b)}`);

/** « 1 234,5 » → centimes ; null si vide ; NaN si invalide (contrôle définitif côté serveur). */
function parse(text: string): number | null {
  const s = text.replace(/[\s  €]/g, "");
  if (!s) return null;
  const m = /^(\d{1,9})(?:[.,](\d{1,2}))?$/.exec(s);
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0")) : Number.NaN;
}

export function TariffGridEditor({ id, revision, editable, dimLabel, currency, cells, importedAt, action }: { id: string; revision: number; editable: boolean; dimLabel: string; currency: string | null; cells: EditorCell[]; importedAt: string | null; action: (fd: FormData) => Promise<void> }) {
  const initial = useMemo(() => new Map(cells.map((c) => [key(c.dimAmm, c.widthMinMm, c.widthMaxMm), c])), [cells]);
  const [dims, setDims] = useState(() => [...new Set(cells.map((c) => c.dimAmm))].sort((a, b) => a - b));
  const [widths, setWidths] = useState(() => {
    const m = new Map<string, [number, number]>();
    for (const c of cells) m.set(`${c.widthMinMm}|${c.widthMaxMm}`, [c.widthMinMm, c.widthMaxMm]);
    return [...m.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  });
  const [vals, setVals] = useState<Map<string, Val>>(() => new Map());
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [bulk, setBulk] = useState("");
  const [pct, setPct] = useState("");
  const [newDim, setNewDim] = useState("");
  const [newW, setNewW] = useState({ min: "", max: "" });
  const [msg, setMsg] = useState<string | null>(null);

  const current = (k: string): Val => vals.get(k) ?? (initial.has(k) ? { kind: "value", text: toText(initial.get(k)!.amountMinor) } : { kind: "absent" });
  const setVal = (k: string, v: Val) => setVals((m) => new Map(m).set(k, v));

  const edits = useMemo(() => {
    const out: { dimAmm: number; widthMinMm: number; widthMaxMm: number; action: "set" | "clear" | "remove"; value?: string }[] = [];
    for (const [k, v] of vals) {
      const [d, w0, w1] = k.split("|").map(Number) as [number, number, number];
      const init = initial.get(k);
      if (v.kind === "absent") { if (init) out.push({ dimAmm: d, widthMinMm: w0, widthMaxMm: w1, action: "remove" }); continue; }
      const minor = parse(v.text);
      if (init && minor === init.amountMinor) continue;
      out.push(minor == null ? { dimAmm: d, widthMinMm: w0, widthMaxMm: w1, action: init ? "clear" : "set", value: "" } : { dimAmm: d, widthMinMm: w0, widthMaxMm: w1, action: "set", value: v.text });
    }
    return out;
  }, [vals, initial]);
  const invalid = edits.filter((e) => e.action === "set" && e.value && Number.isNaN(parse(e.value))).length;

  const allKeys = dims.flatMap((d) => widths.map(([a, b]) => key(d, a, b)));
  const toggle = (ks: string[]) => setSel((s) => { const n = new Set(s); const all = ks.every((k) => n.has(k)); for (const k of ks) { if (all) n.delete(k); else n.add(k); } return n; });

  function applyBulk(kind: "value" | "pct" | "clear" | "absent") {
    if (!sel.size) { setMsg("Sélectionnez d'abord des cellules (case à cocher, en-tête de ligne ou de colonne)."); return; }
    setMsg(null);
    setVals((m) => {
      const n = new Map(m);
      for (const k of sel) {
        if (kind === "absent") n.set(k, { kind: "absent" });
        else if (kind === "clear") n.set(k, { kind: "value", text: "" });
        else if (kind === "value") n.set(k, { kind: "value", text: bulk });
        else {
          const cur = current(k);
          const minor = cur.kind === "value" ? parse(cur.text) : null;
          const p = /^([+-]?)(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(pct.trim());
          if (minor == null || Number.isNaN(minor) || !p) continue;
          const bp = (p[1] === "-" ? -1 : 1) * (Number(p[2]) * 100 + Number((p[3] ?? "").padEnd(2, "0")));
          // centimes × (1 + p) arrondi au centime, demi supérieur (entiers exacts)
          const num = minor * (10_000 + bp);
          const r = Math.floor((2 * num + 10_000) / 20_000);
          if (r >= 0) n.set(k, { kind: "value", text: toText(r) });
        }
      }
      return n;
    });
  }

  function addDim() {
    const v = Math.round(Number(newDim.replace(",", ".")) || 0);
    if (!Number.isInteger(v) || v <= 0 || v > 100_000) { setMsg("Dimension : entier en mm."); return; }
    if (!dims.includes(v)) setDims((d) => [...d, v].sort((a, b) => a - b));
    setNewDim("");
  }
  function addWidth() {
    const a = Math.round(Number(newW.min) || 0), b = Math.round(Number(newW.max || newW.min) || 0);
    if (a <= 0 || b < a || b > 100_000) { setMsg("Largeur : entiers en mm (min ≤ max)."); return; }
    if (!widths.some(([x, y]) => x === a && y === b)) setWidths((w) => [...w, [a, b] as [number, number]].sort((p, q) => p[0] - q[0] || p[1] - q[1]));
    setNewW({ min: "", max: "" });
  }

  const f = focus ? initial.get(focus) : null;
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-sand-200 bg-sand-50 p-3 text-sm" aria-label="Actions sur la sélection">
          <span className="mr-2" aria-live="polite">Sélection : <strong>{sel.size}</strong> cellule(s)</span>
          <label className="flex flex-col text-xs">Valeur ({currency ?? "devise ?"})<input className="input min-h-0 w-28 py-1" inputMode="decimal" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="1234,56" /></label>
          <button type="button" className="btn-secondary min-h-0 py-1" onClick={() => applyBulk("value")}>Appliquer la valeur</button>
          <label className="flex flex-col text-xs">Variation (%)<input className="input min-h-0 w-20 py-1" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="+3,5" /></label>
          <button type="button" className="btn-secondary min-h-0 py-1" onClick={() => applyBulk("pct")}>Appliquer la variation</button>
          <button type="button" className="btn-secondary min-h-0 py-1" onClick={() => applyBulk("clear")}>Vider</button>
          <button type="button" className="btn-secondary min-h-0 py-1" onClick={() => applyBulk("absent")}>Retirer (non tarifée)</button>
          <button type="button" className="btn-ghost min-h-0 py-1" onClick={() => setSel(new Set(allKeys))}>Tout sélectionner</button>
          <button type="button" className="btn-ghost min-h-0 py-1" onClick={() => setSel(new Set())}>Désélectionner</button>
        </div>
      )}
      {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
      <div className="relative max-h-[70vh] overflow-auto rounded-md border border-sand-200">
        <table className="border-collapse text-xs tabular-nums" data-testid="tariff-matrix">
          <caption className="sr-only">Grille : {dimLabel} (lignes, m) × largeur (colonnes, m), montants en {currency ?? "devise non renseignée"}</caption>
          <thead className="sticky top-0 z-10 bg-sand-100">
            <tr>
              <th scope="col" className="sticky left-0 z-20 bg-sand-100 p-2 text-left font-medium">{dimLabel} (m) ↓ · Largeur (m) →</th>
              {widths.map(([a, b]) => (
                <th key={`${a}|${b}`} scope="col" className="p-1 font-medium">
                  {editable ? <button type="button" className="underline decoration-dotted" title="Sélectionner la colonne" onClick={() => toggle(dims.map((d) => key(d, a, b)))}>{fmtW(a, b)}</button> : fmtW(a, b)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dims.map((d) => (
              <tr key={d}>
                <th scope="row" className="sticky left-0 z-10 bg-sand-100 p-1 text-left font-medium">
                  {editable ? <button type="button" className="underline decoration-dotted" title="Sélectionner la ligne" onClick={() => toggle(widths.map(([a, b]) => key(d, a, b)))}>{fmtM(d)}</button> : fmtM(d)}
                </th>
                {widths.map(([a, b]) => {
                  const k = key(d, a, b);
                  const v = current(k);
                  const init = initial.get(k);
                  const dirty = vals.has(k) && edits.some((e) => key(e.dimAmm, e.widthMinMm, e.widthMaxMm) === k);
                  const minor = v.kind === "value" ? parse(v.text) : null;
                  const state = v.kind === "absent" ? "absent" : minor == null ? "empty" : Number.isNaN(minor) ? "invalid" : minor === 0 ? "zero" : "priced";
                  const cls = { absent: "bg-sand-100 text-stone-700", empty: "bg-danger/10 outline outline-1 outline-danger", invalid: "bg-danger/20 outline outline-2 outline-danger", zero: "bg-warning/15", priced: init && init.status !== "OK" ? "bg-warning/5" : "bg-white" }[state];
                  const label = `${dimLabel} ${fmtM(d)} m × largeur ${fmtW(a, b)} m`;
                  return (
                    <td key={k} className={`border border-sand-200 p-0.5 ${cls} ${dirty ? "ring-2 ring-brand-500" : ""} ${sel.has(k) ? "bg-brand-50" : ""}`} data-state={state}>
                      <div className="flex items-center gap-0.5">
                        {editable && <input type="checkbox" className="h-3 w-3" aria-label={`Sélectionner ${label}`} checked={sel.has(k)} onChange={() => toggle([k])} />}
                        {v.kind === "absent" ? (
                          editable ? <button type="button" className="w-20 px-1 py-1 text-left text-stone-700" title="Combinaison non tarifée (devis). Cliquer pour la tarifer." onClick={() => setVal(k, { kind: "value", text: "" })} aria-label={`${label} : non tarifée, ajouter un prix`}>—</button> : <span className="block w-20 px-1 py-1 text-stone-700" title="Non tarifée : devis">—</span>
                        ) : editable ? (
                          <input className="w-20 bg-transparent px-1 py-1 text-right" inputMode="decimal" aria-label={label} value={v.text} placeholder="vide" onFocus={() => setFocus(k)} onChange={(e) => setVal(k, { kind: "value", text: e.target.value })} />
                        ) : (
                          <button type="button" className="w-20 px-1 py-1 text-right" onClick={() => setFocus(k)} aria-label={`${label} : ${v.text || "vide"}`}>{v.text || <em className="text-danger">vide</em>}</button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-700">Légende : <span className="bg-white px-1 outline outline-1 outline-sand-300">montant</span> · <span className="bg-warning/15 px-1">0,00 = prix nul (à confirmer)</span> · <span className="bg-danger/10 px-1 outline outline-1 outline-danger">vide = à renseigner (bloque la publication)</span> · <span className="bg-sand-100 px-1">— = non tarifée (devis)</span> · <span className="bg-warning/5 px-1">ligne importée « à vérifier »</span>. Aucune interpolation : une combinaison absente reste au devis.</p>

      <div className="rounded-md border border-sand-200 p-3 text-sm" aria-live="polite" data-testid="cell-origin">
        {f ? (
          <>
            <p className="font-medium">Origine de la cellule {fmtM(f.dimAmm)} × {fmtW(f.widthMinMm, f.widthMaxMm)} m</p>
            <ul className="mt-1 list-disc pl-5 text-stone-800">
              <li>{f.origin === "IMPORT" ? "Fichier, feuille et cellule" : f.origin === "DERIVED" ? "Recalcul" : "Saisie manuelle"} : <code className="break-all">{f.sourceRef}</code></li>
              {f.origin === "IMPORT" && importedAt && <li>Importée le {new Date(importedAt).toLocaleString("fr-FR")}</li>}
              {f.formula && <li>Formule du classeur (valeur en cache, jamais recalculée) : <code>{f.formula}</code></li>}
              {f.editedAt && <li>Modifiée le {new Date(f.editedAt).toLocaleString("fr-FR")}{f.editedBy ? ` par ${f.editedBy}` : ""}</li>}
              {f.issues.map((i) => <li key={i} className="text-warning">{i}</li>)}
            </ul>
          </>
        ) : <p className="text-stone-700">Cliquez sur une cellule pour afficher son origine (fichier, feuille, cellule, date d'import, modifications).</p>}
      </div>

      {editable && (
        <>
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col text-xs">Nouvelle ligne : {dimLabel.toLowerCase()} (mm)<input className="input min-h-0 w-32 py-1" inputMode="numeric" value={newDim} onChange={(e) => setNewDim(e.target.value)} /></label>
            <button type="button" className="btn-secondary min-h-0 py-1" onClick={addDim}>Ajouter la ligne</button>
            <label className="flex flex-col text-xs">Nouvelle colonne : largeur min. (mm)<input className="input min-h-0 w-28 py-1" inputMode="numeric" value={newW.min} onChange={(e) => setNewW((w) => ({ ...w, min: e.target.value }))} /></label>
            <label className="flex flex-col text-xs">max. (mm, vide = ponctuelle)<input className="input min-h-0 w-28 py-1" inputMode="numeric" value={newW.max} onChange={(e) => setNewW((w) => ({ ...w, max: e.target.value }))} /></label>
            <button type="button" className="btn-secondary min-h-0 py-1" onClick={addWidth}>Ajouter la colonne</button>
          </div>
          <form action={action} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="revision" value={revision} />
            <input type="hidden" name="edits" value={JSON.stringify(edits)} />
            <button className="btn-primary" type="submit" disabled={!edits.length || invalid > 0} data-testid="save-cells">Enregistrer {edits.length} modification(s)</button>
            {invalid > 0 && <span className="text-sm text-danger">{invalid} montant(s) invalide(s) : nombre positif, deux décimales au plus.</span>}
            {edits.length > 0 && <button type="button" className="btn-ghost" onClick={() => setVals(new Map())}>Annuler les modifications</button>}
          </form>
        </>
      )}
    </div>
  );
}
