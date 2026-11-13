import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table } from "@/components/admin/ui";
import { SALE_BASIS_FR } from "@/domain/market";
import { adviceOverview } from "@/server/market/advice";
import { previewDefaultPricing } from "@/server/market/default-pricing";
import { prepareAdvicePriceAction, prepareDefaultPricingAction, publishDefaultPricingAction } from "@/server/actions/admin/advice";
import { MarketNote, eur, pctFr } from "../comparatif-marche/labels";

export const metadata: Metadata = { title: "Mes prix conseillés" };

const CONF_TONE = { elevee: "ok", moyenne: "ok", indicative: "warn", simulation_interne: "neutral" } as const;
const CONF_SHORT = { elevee: "élevée", moyenne: "moyenne", indicative: "indicative", simulation_interne: "marché insuffisant" } as const;

export default async function AdvicePage(props: PageProps<"/admin/tarifs/prix-conseilles">) {
  await requireRole(["ADMIN"]);
  const o = await adviceOverview();
  const preview = o.policy?.marginTargetBps != null ? await previewDefaultPricing().catch(() => null) : null;
  const toUpdate = preview?.rows.filter((r) => !r.refused && !r.draft) ?? [];
  const drafts = preview?.rows.filter((r) => r.draft && !r.draft.created && r.draft.id !== r.current.id) ?? [];
  const refused = preview?.rows.filter((r) => r.refused) ?? [];
  return (
    <div className="space-y-6">
      <PageTitle title="Mes prix conseillés" backHref="/admin/tarifs" backLabel="Tarifs">
        <Link href="/admin/tarifs/prix-conseilles" className="btn-secondary" data-testid="advice-refresh">Actualiser</Link>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <MarketNote />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="advice-header">
        <div className="card p-4"><p className="text-xs text-stone-700">Marge brute cible</p><p className="font-display text-2xl" data-testid="advice-margin">{o.policy?.marginTargetBps != null ? pctFr(o.policy.marginTargetBps) : "non définie"}</p><p className="text-xs text-stone-700">du prix de vente HT — politique v{o.policy?.version ?? "—"} · <Link className="underline" href="/admin/tarifs/comparatif-marche/politique">modifier</Link></p></div>
        <div className="card p-4"><p className="text-xs text-stone-700">Derniers relevés</p><p className="font-display text-2xl">{o.lastObservedAt ? o.lastObservedAt.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "aucun"}</p><p className="text-xs text-stone-700">{o.observations} relevé(s) actif(s) · <Link className="underline" href="/admin/tarifs/comparatif-marche/releves">voir, ajouter</Link></p></div>
        <div className="card p-4"><p className="text-xs text-stone-700">Produits réellement comparés</p><p className="font-display text-2xl" data-testid="advice-compared">{o.compared} / {o.rows.length}</p><p className="text-xs text-stone-700">au moins une offre fortement comparable retenue</p></div>
        <div className="card p-4"><p className="text-xs text-stone-700">Remise revendeur</p><p className="font-display text-2xl">{o.policy ? pctFr(o.policy.discountBps) : "—"}</p><p className="text-xs text-stone-700">sur les postes éligibles (coût interne, jamais une remise client)</p></div>
      </div>

      <Section title="Résumé des écarts">
        {o.summary.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{o.summary.map((s) => <li key={s}>{s}</li>)}</ul> : <p className="text-sm" data-testid="advice-summary">Aucun produit ne dispose encore d'une offre fortement comparable (même produit, dimensions et pose proches, prix normal TTC, périmètre équivalent ou normalisable) : les prix sont calculés selon votre marge cible. Les offres apparentées sont indiquées à titre d'information, sans servir de prix de marché.</p>}
      </Section>

      <Section title="Prix par produit (configuration de référence)">
        <Table caption="Prix conseillés par produit">
          <thead><tr><th>Produit</th><th>Configuration de référence</th><th>Prix public actuel</th><th>Prix à la marge cible</th><th>Concurrents comparables</th><th>Prix conseillé</th><th>Marge brute</th><th>Confiance</th><th>Actions</th></tr></thead>
          <tbody>
            {o.rows.map((r) => (
              <tr key={r.familySlug} data-testid={`advice-row-${r.familySlug}`}>
                <td className="min-w-40">
                  <div className="flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la médiathèque */}
                    {r.image ? <img src={r.image.path} alt="" width={56} height={42} className="h-[42px] w-14 shrink-0 border border-sand-200 bg-white object-contain" /> : <span className="grid h-[42px] w-14 shrink-0 place-items-center border border-dashed border-sand-300 text-[10px] text-stone-700">sans visuel</span>}
                    <span className="font-medium">{r.name}</span>
                  </div>
                </td>
                <td className="max-w-56 text-xs">{r.referenceText}<span className="block text-stone-700">{r.referenceWhy}</span></td>
                <td className="tabular-nums" data-testid="advice-current">{r.current ? <>{eur(r.current.ttcMinor)} TTC<span className="block text-xs text-stone-700">{eur(r.current.htMinor)} HT</span></> : "—"}</td>
                <td className="tabular-nums" data-testid="advice-target">{r.target ? <>{eur(r.target.ttcMinor)} TTC<span className="block text-xs text-stone-700">{eur(r.target.htMinor)} HT</span>{r.target.partial && <span className="mt-1 block"><StatusBadge tone="warn">marge non garantie</StatusBadge></span>}</> : "—"}</td>
                <td className="text-xs tabular-nums" data-testid="advice-market">
                  {r.market.n ? <>{eur(r.market.minTtc)} – {eur(r.market.maxTtc)} TTC<span className="block text-stone-700">médiane {eur(r.market.medianTtc)} · {r.market.n} offre(s), {r.market.independent} indép.</span></> : <span>aucune offre retenue</span>}
                  {r.related.n > 0 && <span className="mt-1 block text-stone-700">{r.related.n} apparentée(s) non retenue(s) : {eur(r.related.min)} – {eur(r.related.max)} affichés</span>}
                </td>
                <td className="tabular-nums" data-testid="advice-price">{r.advice ? <><strong>{eur(r.advice.ttcMinor)} TTC</strong><span className="block text-xs text-stone-700">{eur(r.advice.htMinor)} HT</span><span className="mt-1 block max-w-48 text-xs">{r.advice.title}</span></> : r.error ?? "—"}</td>
                <td className="text-xs tabular-nums" data-testid="advice-marginrow">{r.margin ? (r.margin.partial ? <>{pctFr(r.margin.prudent.onPriceBps)} <span className="text-stone-700">({eur(r.margin.prudent.grossMinor)})</span><span className="block text-stone-700">hypothèse prudente : coût incomplet</span></> : <>{pctFr(r.margin.known.onPriceBps)} <span className="text-stone-700">({eur(r.margin.known.grossMinor)})</span></>) : "—"}</td>
                <td><StatusBadge tone={CONF_TONE[r.confidence]}>{CONF_SHORT[r.confidence]}</StatusBadge></td>
                <td className="min-w-44 text-xs">
                  <details data-testid="advice-understand"><summary className="cursor-pointer font-medium text-brand-700">Comprendre</summary><ul className="mt-2 list-disc space-y-1 pl-4">{r.explanation.map((x) => <li key={x}>{x}</li>)}</ul>{r.related.reasons.length > 0 && <p className="mt-1 text-stone-700">Offres apparentées écartées : {r.related.reasons.join(" ; ")}.</p>}{r.query && <Link className="mt-2 inline-block underline" href={`/admin/tarifs/comparatif-marche?${r.query}`}>Voir le détail</Link>}</details>
                  {r.canPrepare ? (
                    <form action={prepareAdvicePriceAction} className="mt-2"><input type="hidden" name="familySlug" value={r.familySlug} /><button className="btn-secondary min-h-0 py-1 text-xs" data-testid="advice-prepare">Préparer ce prix</button></form>
                  ) : (
                    <p className="mt-2 text-stone-700" data-testid="advice-prepare-none">Préparer ce prix : {r.advice && r.current && r.advice.htMinor === r.current.htMinor ? "déjà en vigueur" : "aucun prix établi"}</p>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-stone-700">Prix TTC avec la TVA française validée (20 %). Marge brute = vente HT − achat net HT, en % du prix de vente HT ; elle ne déduit ni livraison, pose, frais de paiement, acquisition, SAV ni commission (voir « Comprendre ») et n'est jamais un bénéfice net. Un prix conseillé différent de la marge cible n'est proposé qu'avec au moins trois offres fortement comparables et indépendantes, jamais sous le plancher. « Préparer ce prix » crée un brouillon d'une seule cellule (ancien prix, nouveau prix, marge et périmètre dans la proposition) ; sa publication reste une action explicite dans Grilles tarifaires, avec historique et retour arrière.</p>
      </Section>

      <Section title="Politique par défaut : grilles à la marge cible">
        <p className="text-sm">Vente HT = achat net HT ÷ (1 − marge cible), achat net = catalogue × (1 − remise) sur les postes éligibles. Bases de calcul : {Object.values(SALE_BASIS_FR).join(" ; ")}. Exceptions commerciales validées : aucune (toutes les grilles de vente suivaient le catalogue × 1 avant cette politique).</p>
        {!preview ? <p className="mt-2 text-sm">Fixez d'abord une marge cible dans la politique de coût.</p> : (
          <div className="mt-3 space-y-3 text-sm" data-testid="default-pricing">
            <p>{preview.rows.length} grille(s) de vente publiée(s) : <strong>{preview.rows.length - toUpdate.length - refused.length}</strong> déjà conforme(s) ou en brouillon, <strong>{toUpdate.length}</strong> à recalculer{refused.length ? <>, <strong>{refused.length}</strong> impossible(s) ({refused.map((r) => `${r.familySlug} : ${r.refused}`).join(" ; ")})</> : null}.</p>
            {toUpdate.length > 0 && <ul className="list-disc pl-5 text-xs">{toUpdate.map((r) => <li key={r.saleId}>{r.familySlug}{r.variantKey ? ` / ${r.variantKey}` : ""} : {r.changedCells}/{r.cells} cellule(s){r.sample ? `, ex. ${eur(r.sample.before)} → ${eur(r.sample.after)} HT` : ""} ; suppléments d'éligibilité inconnue conservés : {r.supplements.unknown_kept.length}</li>)}</ul>}
            <div className="flex flex-wrap gap-2">
              <form action={prepareDefaultPricingAction}><button className="btn-secondary" disabled={!toUpdate.length} data-testid="default-prepare">Préparer les brouillons</button></form>
              <form action={publishDefaultPricingAction}><button className="btn-accent" disabled={!drafts.length} data-testid="default-publish">Publier les brouillons de la politique</button></form>
              <Link className="btn-ghost" href="/admin/tarifs/grilles">Voir les grilles et l'historique</Link>
            </div>
            {drafts.length > 0 && <p className="text-xs">Brouillons en attente : {drafts.map((d) => `${d.familySlug}${d.variantKey ? `/${d.variantKey}` : ""} v${d.draft!.version}`).join(", ")}.</p>}
          </div>
        )}
      </Section>
    </div>
  );
}
