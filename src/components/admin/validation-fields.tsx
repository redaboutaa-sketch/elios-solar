import { formatEur } from "@/domain/money";
import { ENUM_VALUES, FIELD_FR, PROPOSABLE, SOURCE_KIND_FR, VALIDATION_STATUS_FR, type SourceKind, type TargetType, type ValidationStatus } from "@/server/validation/core";
import { StatusBadge } from "./ui";

const ENUM_FR: Record<string, string> = {
  AVAILABLE: "Disponible", ON_ORDER: "Sur commande", OUT_OF_STOCK: "Rupture", TO_CONFIRM: "À confirmer",
  BUSINESS_DAYS: "jours ouvrés", CALENDAR_DAYS: "jours calendaires", WEEKS: "semaines",
  ALLOWED: "Autorisé", FORBIDDEN: "Interdit", UNKNOWN: "Inconnu",
};

/** Affichage lisible d'une valeur de données (centimes → euros, booléens, JSON). */
export function fmtValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if ((field === "priceCents" || field === "compareAtCents") && typeof v === "number") return `${formatEur(v)} (${v} c)`;
  if (typeof v === "boolean") return v ? "oui" : "non";
  if (typeof v === "string") return ENUM_FR[v] ?? v;
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

export function ValidationStatusBadge({ status }: { status: ValidationStatus }) {
  const tone = status === "VALIDATED" ? "ok" : status === "REJECTED" ? "err" : status === "TO_REVIEW" ? "warn" : "neutral";
  return <StatusBadge tone={tone}>{VALIDATION_STATUS_FR[status]}</StatusBadge>;
}

/** Champs « données proposées » (vide = inchangé). */
export function ProposalFields({ type, current, proposed = {} }: { type: TargetType; current: Record<string, unknown>; proposed?: Record<string, unknown> }) {
  const cell = "input py-1.5 text-sm";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(PROPOSABLE[type]).map(([k, kind]) => {
        const id = `p_${k}`;
        const label = `${FIELD_FR[k] ?? k} — actuel : ${fmtValue(k, current[k])}`;
        const def = proposed[k] === undefined ? "" : kind === "json" ? JSON.stringify(proposed[k], null, 1) : String(proposed[k]);
        if (kind === "enum") return <div key={k}><label className="label" htmlFor={id}>{label}</label><select id={id} name={id} defaultValue={def} className={cell}><option value="">(inchangé)</option>{ENUM_VALUES[k]!.map((x) => <option key={x} value={x}>{ENUM_FR[x] ?? x}</option>)}</select></div>;
        if (kind === "bool") return <div key={k}><label className="label" htmlFor={id}>{label}</label><select id={id} name={id} defaultValue={def} className={cell}><option value="">(inchangé)</option><option value="true">oui</option><option value="false">non</option></select></div>;
        if (kind === "json") return <div key={k} className="sm:col-span-2"><label className="label" htmlFor={id}>{FIELD_FR[k] ?? k} — JSON partiel fusionné avec l'actuel</label><textarea id={id} name={id} rows={3} defaultValue={def} className={`${cell} font-mono`} placeholder='{"usableWidthMm": 4640}' /><p className="mt-1 text-xs text-stone-700 break-all">Actuel : {fmtValue(k, current[k])}</p></div>;
        return <div key={k}><label className="label" htmlFor={id}>{label}</label><input id={id} name={id} defaultValue={def} inputMode={kind === "int" ? "numeric" : undefined} className={cell} /></div>;
      })}
      <p className="sm:col-span-2 text-xs text-stone-700">« Achetable » ne fait pas partie des données validables : la mise en vente se décide séparément, une fois prix, disponibilité et compatibilités validés.</p>
    </div>
  );
}

export function SourceFields({ documents, value }: { documents: Array<{ id: string; title: string; version: number; status: string }>; value?: { sourceKind: SourceKind | null; sourceUrl: string | null; documentId: string | null; sourceNote: string } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className="label" htmlFor="sourceKind">Nature de la source</label><select id="sourceKind" name="sourceKind" defaultValue={value?.sourceKind ?? ""} className="input"><option value="">(à renseigner)</option>{(Object.keys(SOURCE_KIND_FR) as SourceKind[]).map((k) => <option key={k} value={k}>{SOURCE_KIND_FR[k]}</option>)}</select></div>
      <div><label className="label" htmlFor="documentId">Document justificatif</label><select id="documentId" name="documentId" defaultValue={value?.documentId ?? ""} className="input"><option value="">(aucun)</option>{documents.map((d) => <option key={d.id} value={d.id}>{d.title} v{d.version}{d.status !== "PUBLISHED" ? ` (${d.status})` : ""}</option>)}</select></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="sourceUrl">Lien de la source (facultatif)</label><input id="sourceUrl" name="sourceUrl" defaultValue={value?.sourceUrl ?? ""} className="input" placeholder="https://… ou /media/…" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="sourceNote">Référence et contexte de la source</label><textarea id="sourceNote" name="sourceNote" rows={3} defaultValue={value?.sourceNote ?? ""} className="input" placeholder="Ex. : fiche technique fournisseur v3 du 12/10, page 4 ; e-mail du fournisseur du …" /></div>
    </div>
  );
}
