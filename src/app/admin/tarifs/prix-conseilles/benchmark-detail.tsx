import { StatusBadge } from "@/components/admin/ui";
import { ADVICE_STATUS_FR, CONTROL_KIND_FR, EVIDENCE_FR, FRESHNESS_FR, PRICE_SCOPE_FR, USAGE_FR, ttcOf, type BenchEval, type MatchLevel } from "@/domain/market-benchmark";
import type { ConfigRow } from "@/server/market/advice";
import { MOUNTING_OBS_FR, eur, pctFr } from "../comparatif-marche/labels";

const LEVEL_TONE = { A: "ok", B: "warn", C: "neutral", D: "err" } as const;
const TAX_FR = { HT: "HT", TTC: "TTC", UNKNOWN: "HT/TTC non indiqué" } as const;
const MARKET_FR = { direct: "marché direct", local_accessible: "prix local, livre FR/BE", local_unknown: "prix local, accès FR/BE inconnu", separate: "groupe distinct (GB)" } as const;
/** noms de champs saisis par la collecte → libellés lisibles */
const FIELD_FR: Record<string, string> = { warranty: "garantie", sav: "SAV", resistance: "résistance au vent", promoEnd: "fin de promotion", manufacturer: "fabricant", supplierSystem: "système fournisseur", "deliversTo.FR": "livraison vers la France", "deliversTo.BE": "livraison vers la Belgique", "delivery.extraAmountMinor": "montant de la livraison", "installation.extraAmountMinor": "montant de la pose", material: "matériau", blades: "lames / toile", heightMm: "hauteur", depthMm: "avancée", widthMm: "largeur", taxBasis: "HT ou TTC", mounting: "implantation", controlKind: "type de commande" };
const fieldFr = (k: string) => FIELD_FR[k] ?? k;
const date = (d: Date | null) => (d ? d.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—");
const mm = (v: number | null) => (v == null ? "?" : (v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 }));

export const STATUS_TONE = { direct: "ok", indicative: "warn", product_only: "warn", to_refresh: "warn", insufficient: "neutral" } as const;

export function LevelBadge({ level }: { level: MatchLevel }) {
  return <StatusBadge tone={LEVEL_TONE[level]}>{level}</StatusBadge>;
}

function Offer({ e, vat }: { e: BenchEval; vat: number }) {
  const o = e.obs;
  const dims = `${mm(o.widthMm)} × ${mm(o.heightMm ?? o.depthMm)} m`;
  const cur = o.currency === "EUR" ? "" : ` ${o.currency}`;
  return (
    <tr data-testid="bench-offer" data-level={e.level} data-usage={e.usage}>
      <td className="min-w-40"><a className="underline" href={o.url} rel="noopener noreferrer nofollow" target="_blank">{o.retailer}</a><span className="block text-stone-700">{o.model}</span><span className="block text-stone-700">{o.country} · {MARKET_FR[e.market]}</span></td>
      <td>{dims}<span className="block text-stone-700">{MOUNTING_OBS_FR[o.mounting] ?? o.mounting} · {CONTROL_KIND_FR[o.controlKind]}</span></td>
      <td className="tabular-nums">{e.promoMinor != null ? <>{e.regularMinor != null ? <s>{eur(e.regularMinor)}</s> : null} <strong>{eur(e.promoMinor)}</strong>{cur} <span className="block">promotion{o.promoEnd ? ` jusqu'au ${date(o.promoEnd)}` : ""}{o.promoConditions ? ` (${o.promoConditions})` : ""}</span></> : <>{eur(e.observedMinor)}{cur}</>} <span className="block text-stone-700">{TAX_FR[e.tax]}{o.fx ? ` · converti au ${o.fx.date} (${o.fx.source})` : ""}</span></td>
      <td>{PRICE_SCOPE_FR[e.priceScope]}{e.adjustments.length > 0 && <span className="block text-stone-700">{e.adjustments.map((a) => `${a.note} (${a.amountMinor > 0 ? "+" : ""}${eur(a.amountMinor)})`).join(" ; ")}</span>}</td>
      <td className="tabular-nums">{e.comparableHtMinor != null ? <>{eur(ttcOf(e.comparableHtMinor, vat))} TTC<span className="block text-stone-700">{eur(e.comparableHtMinor)} HT</span></> : "non établi"}</td>
      <td className="max-w-72">{[...e.differences.map((d) => `écart : ${d}`), ...e.unknown.map((u) => `inconnu : ${fieldFr(u)}`)].join(" ; ") || "—"}</td>
      <td className="max-w-72"><LevelBadge level={e.level} /> {USAGE_FR[e.usage]}<span className="block text-stone-700">{[...e.levelWhy.slice(1), ...e.usageWhy].join(" ; ")}</span></td>
      <td>{date(o.observedAt)}<span className="block text-stone-700">{FRESHNESS_FR[e.freshness]} · {EVIDENCE_FR[e.evidence]}</span></td>
    </tr>
  );
}

export function BenchmarkDetail({ row, vat }: { row: ConfigRow; vat: number }) {
  const p = row.position;
  const groups: Array<[string, BenchEval[]]> = [
    ["A — même système", row.evals.filter((e) => e.level === "A")],
    ["B — équivalents techniques", row.evals.filter((e) => e.level === "B")],
    ["C — alternatives commerciales (contexte, hors calcul)", row.evals.filter((e) => e.level === "C")],
    ["D — non exploitables", row.evals.filter((e) => e.level === "D")],
  ];
  return (
    <div className="mt-2 space-y-3 text-xs" data-testid="bench-detail">
      <div>
        <p className="font-medium">Calcul</p>
        <ul className="list-disc space-y-1 pl-4">{[...(row.advice?.steps ?? []), ...row.limits].map((x) => <li key={x}>{x}</li>)}</ul>
        {row.advice?.conflict && <p className="mt-1 rounded border border-danger/40 bg-danger/5 px-2 py-1 text-danger" data-testid="bench-conflict">{row.advice.conflict}</p>}
        {row.margin?.beforeRounding && row.margin.prudent.onPriceBps !== row.margin.beforeRounding.onPriceBps && <p className="mt-1">Effet de l'arrondi commercial TTC sur la marge : {pctFr(row.margin.beforeRounding.onPriceBps)} avant, {pctFr(row.margin.prudent.onPriceBps)} après.</p>}
        {row.cell && <p className="mt-1">« Préparer un brouillon » modifie la seule cellule {row.cell.dimAmm} mm × {row.cell.widthMinMm === row.cell.widthMaxMm ? row.cell.widthMaxMm : `${row.cell.widthMinMm}–${row.cell.widthMaxMm}`} mm de la grille de vente ; les autres cellules sont inchangées.</p>}
      </div>
      <p>
        {ADVICE_STATUS_FR[p.status]} · vendeurs indépendants : {p.sellers.direct} direct(s), {p.sellers.indicative} direct(s) ou indicatif(s), {p.sellers.context} en contexte
        {p.outliers.length > 0 && <> · atypiques écartés du calcul : {p.outliers.map((o) => `${o.seller} (${eur(ttcOf(o.htMinor, vat))} TTC)`).join(", ")}</>}
        {row.otherDims > 0 && <> · {row.otherDims} relevé(s) du produit portent sur d'autres dimensions</>}
      </p>
      {p.status === "insufficient" && p.missing.length > 0 && <p data-testid="bench-missing">Données manquantes : {p.missing.map((m) => `${m.reason} (${m.n})`).join(" ; ")}.</p>}
      {groups.map(([title, es]) => es.length > 0 && (
        <div key={title}>
          <p className="font-medium">{title} — {es.length} relevé(s)</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] [&_td]:border-t [&_td]:border-sand-200 [&_td]:px-1 [&_td]:py-1 [&_td]:align-top [&_th]:px-1 [&_th]:text-left [&_th]:font-medium">
              <thead><tr><th>Vendeur</th><th>Configuration</th><th>Prix observé</th><th>Périmètre</th><th>Comparable</th><th>Différences</th><th>Niveau et usage</th><th>Relevé</th></tr></thead>
              <tbody>{es.map((e) => <Offer key={e.obs.id} e={e} vat={vat} />)}</tbody>
            </table>
          </div>
        </div>
      ))}
      {!row.evals.length && <p>Aucun relevé pour ces dimensions.</p>}
    </div>
  );
}
