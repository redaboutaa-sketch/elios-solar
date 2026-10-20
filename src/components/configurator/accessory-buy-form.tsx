"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buildLayout, allSegments, segmentLabel } from "@/domain/layout";
import { formatEur } from "@/domain/money";
import type { AccessoryStandaloneInput, EvaluationResult } from "@/domain/types";
import { addToCartAction, evaluateAction } from "@/server/actions/configurator";
import { IssueList, Notice } from "@/components/ui/alert";
import { QuoteForm } from "./quote-form";
import { optionLabel } from "./pergola-configurator";

type Target = { slug: string; name: string; kind: string; dimensions: Array<{ code: string; label: string; widthMm: number; lengthMm: number }>; finishes: Array<{ code: string; label: string }>; dividerThresholdMm: number | null };
type V = { sku: string; label: string; priceCents: number; purchasable: boolean; dataStatus: string; attributes: Record<string, unknown>; stock: number | null };

export function AccessoryBuyForm({ family, variants, targets }: { family: { slug: string; name: string; kind: "side_closure" | "option" }; variants: V[]; targets: Target[] }) {
  const router = useRouter();
  const [t, setT] = useState({ pergolaFamilySlug: targets[0]?.slug ?? "", dimensionCode: targets[0]?.dimensions[0]?.code ?? "", mounting: "freestanding" as "freestanding" | "wall", finishCode: targets[0]?.finishes[0]?.code ?? "", segmentId: "" });
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState(1);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [busy, start] = useTransition();
  const target = targets.find((x) => x.slug === t.pergolaFamilySlug);
  const dim = target?.dimensions.find((d) => d.code === t.dimensionCode);
  const layout = useMemo(() => (dim && target?.kind === "PERGOLA_STANDARD" ? buildLayout({ widthMm: dim.widthMm, lengthMm: dim.lengthMm, mounting: t.mounting, dividerThresholdMm: target.dividerThresholdMm ?? 6000 }) : null), [dim, target, t.mounting]);
  const segments = layout ? allSegments(layout) : [];
  const seg = segments.find((s) => s.id === t.segmentId) ?? segments[0];
  const structureColor = t.finishCode.startsWith("ANTHRACITE") ? "ANTHRACITE" : t.finishCode === "BLACK" ? "BLACK" : "WHITE";
  const candidates = variants.filter((v) => {
    const a = v.attributes;
    if (family.kind === "side_closure") return (!seg || a.sideLengthMm === seg.lengthMm) && a.colorCode === structureColor && (!a.mounting || a.mounting === t.mounting);
    return (!a.dimensionCode || a.dimensionCode === t.dimensionCode) && (!a.mounting || a.mounting === t.mounting) && (!a.colorCode || a.colorCode === structureColor);
  });
  const effectiveSku = candidates.some((c) => c.sku === sku) ? sku : (candidates[0]?.sku ?? "");
  const input: AccessoryStandaloneInput = { kind: "accessory", familySlug: family.slug, sku: effectiveSku, qty, target: { pergolaFamilySlug: t.pergolaFamilySlug, dimensionCode: t.dimensionCode || undefined, mounting: t.mounting, finishCode: t.finishCode || undefined, segmentLengthMm: seg?.lengthMm }, delivery: { countryCode: "FR" } };
  const check = () => start(async () => { const r = await evaluateAction(input); if (r.ok) { setResult(r.data); setMsg(null); } else setMsg(r.error); });
  return (
    <div className="mt-4 space-y-3">
      <div><label className="label" htmlFor="acc-target">Ma pergola</label><select id="acc-target" className="input" value={t.pergolaFamilySlug} onChange={(e) => { const nt = targets.find((x) => x.slug === e.target.value); setT((p) => ({ ...p, pergolaFamilySlug: e.target.value, dimensionCode: nt?.dimensions[0]?.code ?? "", finishCode: nt?.finishes[0]?.code ?? "", segmentId: "" })); setResult(null); }}>{targets.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}</select></div>
      {target && target.dimensions.length > 0 && <div className="grid grid-cols-2 gap-3">
        <div><label className="label" htmlFor="acc-dim">Dimension</label><select id="acc-dim" className="input" value={t.dimensionCode} onChange={(e) => { setT((p) => ({ ...p, dimensionCode: e.target.value, segmentId: "" })); setResult(null); }}>{target.dimensions.map((d) => <option key={d.code} value={d.code}>{d.label}</option>)}</select></div>
        <div><label className="label" htmlFor="acc-mount">Implantation</label><select id="acc-mount" className="input" value={t.mounting} onChange={(e) => { setT((p) => ({ ...p, mounting: e.target.value as "wall" | "freestanding", segmentId: "" })); setResult(null); }}><option value="freestanding">Autoportée</option><option value="wall">Adossée</option></select></div>
      </div>}
      {target && target.finishes.length > 0 && <div><label className="label" htmlFor="acc-fin">Finition de la pergola</label><select id="acc-fin" className="input" value={t.finishCode} onChange={(e) => { setT((p) => ({ ...p, finishCode: e.target.value })); setResult(null); }}>{target.finishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></div>}
      {family.kind === "side_closure" && layout && <div><label className="label" htmlFor="acc-seg">Côté à équiper</label><select id="acc-seg" className="input" value={seg?.id ?? ""} onChange={(e) => { setT((p) => ({ ...p, segmentId: e.target.value })); setResult(null); }}>{segments.map((s) => <option key={s.id} value={s.id}>{segmentLabel(s, layout)} — {s.lengthMm / 1000} m</option>)}</select></div>}
      <div><label className="label" htmlFor="acc-sku">Référence compatible</label>
        {candidates.length === 0 ? <p className="text-sm text-danger">Aucune référence {family.name} ne correspond à cette pergola (longueur ou finition). Demandez un devis.</p> : <select id="acc-sku" className="input" value={effectiveSku} onChange={(e) => { setSku(e.target.value); setResult(null); }}>{candidates.map((c) => <option key={c.sku} value={c.sku}>{c.label}{c.attributes.option ? ` (${optionLabel(String(c.attributes.option))})` : ""} — {formatEur(c.priceCents)}{c.stock !== null ? ` · stock ${c.stock}` : ""}</option>)}</select>}
      </div>
      <div className="flex items-end gap-3"><div><label className="label" htmlFor="acc-qty">Quantité</label><input id="acc-qty" type="number" min={1} max={20} className="input w-24" value={qty} onChange={(e) => { setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1))); setResult(null); }} /></div><button type="button" className="btn-secondary" onClick={check} disabled={busy || !effectiveSku}>Vérifier la compatibilité</button></div>
      {msg && <Notice tone="error">{msg}</Notice>}
      {result && (
        <div className="border-t border-sand-200 pt-3 space-y-3">
          <IssueList issues={result.issues} />
          {result.purchasable ? <Notice tone="success">Compatible. Total {formatEur(result.totals.goodsGrossCents)} TTC hors livraison.</Notice> : <Notice tone="warn">{result.quoteRecommended ? "Cet assemblage doit être validé : demandez un devis." : "Achat impossible en l'état."}</Notice>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-accent" disabled={busy || !result.purchasable} onClick={() => start(async () => { const r = await addToCartAction(input, null); if (r.ok) router.push("/panier"); else setMsg(r.error); })}>Ajouter au panier</button>
            <button type="button" className="btn-secondary" onClick={() => setShowQuote((s) => !s)}>Demander un devis</button>
          </div>
          {showQuote && <QuoteForm input={input} kind="accessory" configurationId={null} compact />}
        </div>
      )}
    </div>
  );
}
