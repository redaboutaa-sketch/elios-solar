import { SCOPE_FR, SCOPE_KEYS, type Scope } from "@/domain/market";
import type { FamilyInfo } from "@/server/tariffs/queries";

type Obs = Partial<{ retailer: string; manufacturer: string; model: string; url: string; observedAt: Date; country: string; currency: string; familySlug: string; widthMm: number | null; depthMm: number | null; heightMm: number | null; mounting: string; roofType: string; control: string; options: string; priceMinor: number; taxBasis: string; priceKind: string; regularPriceMinor: number | null; promoPriceMinor: number | null; promoEnd: Date | null; scope: unknown; warranty: string; material: string; blades: string; resistance: string; sav: string; comparability: string; comparabilityReason: string; evidence: string; access: string; notes: string; matchLevel: string | null; matchReason: string; supplierSystem: string; sellerGroup: string; language: string; collectionMethod: string; controlKind: string; promoConditions: string; specs: unknown; differences: unknown; unknownFields: unknown; deliversTo: unknown; fx: unknown; capture: string; validation: string; lastCheckedAt: Date | null }>;
const list = (v: unknown) => (Array.isArray(v) ? v.join("\n") : "");

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
      <fieldset className="grid gap-3 md:col-span-4 md:grid-cols-4"><legend>Benchmark : niveau de comparabilité (A même système, B équivalent technique, C alternative, D non exploitable)</legend>
        <label className="flex flex-col">Niveau proposé<select name="matchLevel" className="input min-h-0 py-1" defaultValue={o.matchLevel ?? ""}><option value="">non classé (déduit de la comparabilité)</option><option value="A">A — même système</option><option value="B">B — équivalent technique</option><option value="C">C — alternative commerciale</option><option value="D">D — non exploitable</option></select></label>
        <label className="flex flex-col md:col-span-3">Raison du niveau<input name="matchReason" className="input min-h-0 py-1" defaultValue={o.matchReason ?? ""} /></label>
        {t("supplierSystem", "Système fournisseur cité par la page (seul fondement d'un A)", o.supplierSystem)}
        {t("sellerGroup", "Société vendeuse (déduplication)", o.sellerGroup)}
        <label className="flex flex-col">Commande<select name="controlKind" className="input min-h-0 py-1" defaultValue={o.controlKind ?? "unknown"}><option value="manual">manuelle</option><option value="wired">motorisée filaire</option><option value="radio">motorisée radio</option><option value="motor">motorisée, commande non précisée</option><option value="unknown">inconnue</option></select></label>
        <label className="flex flex-col">Validation<select name="validation" className="input min-h-0 py-1" defaultValue={o.validation ?? "TO_VALIDATE"}><option value="TO_VALIDATE">à valider</option><option value="VALIDATED">validé</option><option value="TO_RECHECK">à revérifier</option><option value="REJECTED">rejeté</option></select></label>
        <label className="flex flex-col">Livre en France<select name="deliversTo_FR" className="input min-h-0 py-1" defaultValue={(o.deliversTo as Record<string, string> | undefined)?.FR ?? ""}><option value="">non renseigné</option><option value="yes">oui</option><option value="no">non</option><option value="unknown">inconnu</option></select></label>
        <label className="flex flex-col">Livre en Belgique<select name="deliversTo_BE" className="input min-h-0 py-1" defaultValue={(o.deliversTo as Record<string, string> | undefined)?.BE ?? ""}><option value="">non renseigné</option><option value="yes">oui</option><option value="no">non</option><option value="unknown">inconnu</option></select></label>
        {t("language", "Langue", o.language)}
        <label className="flex flex-col">Méthode de collecte<select name="collectionMethod" className="input min-h-0 py-1" defaultValue={o.collectionMethod ?? ""}><option value="">non renseignée</option><option value="manual">saisie</option><option value="csv">CSV</option><option value="webfetch">lecture de page</option><option value="curl">HTML statique</option><option value="playwright">configurateur (navigateur piloté)</option></select></label>
        {t("promoConditions", "Conditions de la promotion", o.promoConditions)}
        {t("lastCheckedAt", "Dernière vérification", day(o.lastCheckedAt), { type: "date" })}
        {t("capture", "Capture privée (chemin relatif)", o.capture)}
        <label className="flex flex-col md:col-span-2">Différences documentées (une par ligne)<textarea name="differences" className="input" rows={2} defaultValue={list(o.differences)} /></label>
        <label className="flex flex-col md:col-span-2">Champs inconnus (un par ligne)<textarea name="unknownFields" className="input" rows={2} defaultValue={list(o.unknownFields)} /></label>
        <label className="flex flex-col md:col-span-2">Caractéristiques documentées (« clé : valeur » par ligne)<textarea name="specs" className="input" rows={2} defaultValue={Object.entries((o.specs ?? {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join("\n")} /></label>
        <label className="flex flex-col md:col-span-2">Conversion de devise (JSON : originalCurrency, originalPriceMinor, rate, date, source)<input name="fx" className="input min-h-0 py-1" defaultValue={o.fx ? JSON.stringify(o.fx) : ""} /></label>
      </fieldset>
      {t("access", "Accès à la source", o.access)}
      <label className="flex flex-col md:col-span-3">Notes<textarea name="notes" className="input" rows={2} defaultValue={o.notes ?? ""} /></label>
    </div>
  );
}
