import { SCOPE_FR, SCOPE_KEYS, type Scope } from "@/domain/market";
import type { FamilyInfo } from "@/server/tariffs/queries";

type Obs = Partial<{ retailer: string; manufacturer: string; model: string; url: string; observedAt: Date; country: string; currency: string; familySlug: string; widthMm: number | null; depthMm: number | null; heightMm: number | null; mounting: string; roofType: string; control: string; options: string; priceMinor: number; taxBasis: string; priceKind: string; regularPriceMinor: number | null; promoPriceMinor: number | null; promoEnd: Date | null; scope: unknown; warranty: string; material: string; blades: string; resistance: string; sav: string; comparability: string; comparabilityReason: string; evidence: string; access: string; notes: string }>;

const euros = (m: number | null | undefined) => (m == null ? "" : (m / 100).toFixed(2).replace(".", ","));
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Champs d'un relevé (création et correction). */
export function ObservationFields({ o = {}, fams }: { o?: Obs; fams: FamilyInfo[] }) {
  const scope = (o.scope ?? {}) as Scope;
  const t = (name: string, label: string, v: string | number | null | undefined, extra: Record<string, unknown> = {}) => <label className="flex flex-col">{label}<input name={name} className="input min-h-0 py-1" defaultValue={v ?? ""} {...extra} /></label>;
  return (
    <div className="grid gap-3 text-sm md:grid-cols-4">
      {t("retailer", "Revendeur *", o.retailer, { required: true })}
      {t("manufacturer", "Fabricant / marque (indépendance)", o.manufacturer)}
      {t("model", "Modèle *", o.model, { required: true })}
      {t("url", "URL exacte *", o.url, { required: true, type: "url" })}
      {t("observedAt", "Date du relevé *", day(o.observedAt) || new Date().toISOString().slice(0, 10), { required: true, type: "date" })}
      {t("country", "Pays (ISO) *", o.country ?? "FR", { required: true, pattern: "[A-Za-z]{2}" })}
      {t("currency", "Devise *", o.currency ?? "EUR", { required: true, pattern: "[A-Za-z]{3}" })}
      <label className="flex flex-col">Produit HELIOSTORES comparé *<select name="familySlug" className="input min-h-0 py-1" defaultValue={o.familySlug ?? "marbella"}>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
      {t("widthMm", "Largeur (mm)", o.widthMm, { inputMode: "numeric" })}
      {t("depthMm", "Avancée / profondeur (mm)", o.depthMm, { inputMode: "numeric" })}
      {t("heightMm", "Hauteur (mm)", o.heightMm, { inputMode: "numeric" })}
      <label className="flex flex-col">Implantation<select name="mounting" className="input min-h-0 py-1" defaultValue={o.mounting ?? "unknown"}><option value="freestanding">autoportante</option><option value="wall">adossée</option><option value="unknown">non indiquée</option></select></label>
      {t("roofType", "Type de toiture", o.roofType)}
      {t("control", "Commande", o.control)}
      {t("options", "Options comprises dans le prix", o.options)}
      {t("price", "Prix constaté (€) *", euros(o.priceMinor), { required: true, inputMode: "decimal" })}
      <label className="flex flex-col">HT / TTC *<select name="taxBasis" className="input min-h-0 py-1" defaultValue={o.taxBasis ?? "TTC"}><option value="TTC">TTC</option><option value="HT">HT</option><option value="UNKNOWN">non indiqué</option></select></label>
      <label className="flex flex-col">Nature du prix *<select name="priceKind" className="input min-h-0 py-1" defaultValue={o.priceKind ?? "configured"}><option value="configured">configuration précise</option><option value="fixed_size">taille fixe affichée</option><option value="from">« à partir de »</option></select></label>
      {t("regularPrice", "Prix normal / barré (€)", euros(o.regularPriceMinor), { inputMode: "decimal" })}
      {t("promoPrice", "Prix promotionnel (€)", euros(o.promoPriceMinor), { inputMode: "decimal" })}
      {t("promoEnd", "Fin de promotion", day(o.promoEnd), { type: "date" })}
      <fieldset className="md:col-span-4"><legend>Périmètre (inclus, en supplément, absent, inconnu ; montant seulement s'il est vérifiable)</legend>
        <div className="grid gap-2 md:grid-cols-4">{SCOPE_KEYS.map((k) => (
          <div key={k} className="flex flex-col gap-1 rounded border border-sand-200 p-2 text-xs"><span>{SCOPE_FR[k]}</span>
            <select name={`scope_${k}`} className="input min-h-0 py-1" defaultValue={scope[k]?.status ?? "unknown"}><option value="included">inclus</option><option value="extra">en supplément</option><option value="absent">absent</option><option value="unknown">inconnu</option></select>
            <input name={`scope_${k}_montant`} className="input min-h-0 py-1" placeholder="supplément vérifiable (€)" defaultValue={euros(scope[k]?.extraAmountMinor)} />
            <input name={`scope_${k}_note`} className="input min-h-0 py-1" placeholder="note" defaultValue={scope[k]?.note ?? ""} />
          </div>))}</div>
      </fieldset>
      {t("warranty", "Garantie (vérifiable)", o.warranty)}
      {t("material", "Matériau", o.material)}
      {t("blades", "Lames / toile", o.blades)}
      {t("resistance", "Résistance documentée", o.resistance)}
      {t("sav", "Pièces / SAV", o.sav)}
      <label className="flex flex-col">Comparabilité *<select name="comparability" className="input min-h-0 py-1" defaultValue={o.comparability ?? "PARTIAL"}><option value="STRONG">forte</option><option value="PARTIAL">partielle</option><option value="INSUFFICIENT">insuffisante</option></select></label>
      <label className="flex flex-col md:col-span-2">Raison de la comparabilité<textarea name="comparabilityReason" className="input" rows={2} defaultValue={o.comparabilityReason ?? ""} /></label>
      <label className="flex flex-col md:col-span-2">Citations de la source (verbatim)<textarea name="evidence" className="input" rows={2} defaultValue={o.evidence ?? ""} /></label>
      {t("access", "Accès à la source", o.access)}
      <label className="flex flex-col md:col-span-3">Notes<textarea name="notes" className="input" rows={2} defaultValue={o.notes ?? ""} /></label>
    </div>
  );
}
