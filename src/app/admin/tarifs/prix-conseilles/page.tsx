import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table } from "@/components/admin/ui";
import { SALE_BASIS_FR } from "@/domain/market";
import { ADVICE_STATUS_FR } from "@/domain/market-benchmark";
import { BenchmarkDetail, STATUS_TONE } from "./benchmark-detail";
import { adviceOverview, roundingPreview } from "@/server/market/advice";
import { previewDefaultPricing } from "@/server/market/default-pricing";
import { prepareAdvicePriceAction, prepareDefaultPricingAction, publishDefaultPricingAction } from "@/server/actions/admin/advice";
import { MarketNote, eur, pctFr } from "../comparatif-marche/labels";

export const metadata: Metadata = { title: "Mes prix conseillés" };


export default async function AdvicePage(props: PageProps<"/admin/tarifs/prix-conseilles">) {
  await requireRole(["ADMIN"]);
  const [o, rp] = await Promise.all([adviceOverview(), roundingPreview()]);
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
        <div className="card p-4"><p className="text-xs text-stone-700">Derniers relevés</p><p className="font-display text-2xl">{o.lastObservedAt ? o.lastObservedAt.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "aucun"}</p><p className="text-xs text-stone-700">{o.observations} relevé(s) actif(s), aucune collecte au chargement · <Link className="underline" href="/admin/tarifs/comparatif-marche/releves">voir, importer</Link></p></div>
        <div className="card p-4"><p className="text-xs text-stone-700">Produits réellement comparés</p><p className="font-display text-2xl" data-testid="advice-compared">{o.compared.any} / {o.compared.total}</p><p className="text-xs text-stone-700">dont {o.compared.direct} en comparaison directe (niveau A) ; les autres en positionnement indicatif (niveau B)</p></div>
        <div className="card p-4"><p className="text-xs text-stone-700">Remise revendeur</p><p className="font-display text-2xl">{o.policy ? pctFr(o.policy.discountBps) : "—"}</p><p className="text-xs text-stone-700">sur les postes éligibles confirmés (coût interne, jamais une remise client)</p></div>
      </div>

      <Section title="Lecture">
        <p className="text-sm" data-testid="advice-summary">Chaque produit est étudié sur sa configuration d'appel et des tailles courantes réellement disponibles. Les offres concurrentes sont classées <strong>A</strong> (même système fournisseur), <strong>B</strong> (équivalent technique, différences documentées), <strong>C</strong> (alternative commerciale, contexte seulement) ou <strong>D</strong> (non exploitable) ; la fraîcheur, la preuve et le périmètre du prix (produit seul, livré, posé, HT/TTC) sont indiqués à part. Un vendeur compte une fois, quel que soit le nombre de ses annonces. Le prix conseillé reste celui de la marge cible tant qu'il n'y a pas au moins trois vendeurs directs indépendants ; la fourchette marché sert alors de repère. Rien n'est publié depuis cette page.</p>
      </Section>

      {o.products.map((pr) => (
        <Section key={pr.familySlug} className="space-y-2">
          <div className="flex flex-wrap items-center gap-3" data-testid={`advice-product-${pr.familySlug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- vignette de la médiathèque */}
            {pr.image ? <img src={pr.image.path} alt="" width={56} height={42} className="h-[42px] w-14 shrink-0 border border-sand-200 bg-white object-contain" /> : null}
            <h2 className="font-display text-xl">{pr.name}</h2>
            <p className="text-xs text-stone-700">{pr.observations} relevé(s) actif(s) : {(["A", "B", "C", "D"] as const).map((l) => `${pr.levels[l]} ${l}`).join(" · ")}</p>
          </div>
          <Table caption={`Prix conseillés — ${pr.name}`}>
            <thead><tr><th>Configuration</th><th>Mon prix TTC</th><th>Prix à ma marge cible</th><th>Fourchette marché comparable</th><th>Prix conseillé</th><th>Marge estimée</th><th>Vendeurs indép.</th><th>Niveau</th><th>Vérifié le</th></tr></thead>
            {pr.configs.map((r) => (
              <tbody key={r.key} data-testid={`advice-row-${pr.familySlug}--${r.key}`}>
                <tr>
                  <td className="max-w-56 text-xs">{r.text}<span className="block text-stone-700">{r.why}</span></td>
                  <td className="tabular-nums" data-testid="advice-current">{r.current ? <>{eur(r.current.ttcMinor)} TTC<span className="block text-xs text-stone-700">{eur(r.current.htMinor)} HT</span></> : "—"}</td>
                  <td className="tabular-nums" data-testid="advice-target">{r.target ? <>{eur(r.target.ttcMinor)} TTC<span className="block text-xs text-stone-700">{eur(r.target.htMinor)} HT</span>{r.target.partial && <span className="mt-1 block"><StatusBadge tone="warn">marge non garantie</StatusBadge></span>}</> : "—"}</td>
                  <td className="text-xs tabular-nums" data-testid="advice-market">{r.advice?.rangeTtc ? <>{eur(r.advice.rangeTtc.min)} – {eur(r.advice.rangeTtc.max)} TTC<span className="block text-stone-700">{r.position.range!.basis === "direct" ? "vendeurs directs" : "indicatif"} · {r.position.points.length} vendeur(s)</span></> : <span>aucune offre utilisable</span>}</td>
                  <td className="tabular-nums" data-testid="advice-price">{r.advice?.ttcMinor != null ? <><strong>{eur(r.advice.ttcMinor)} TTC</strong><span className="block text-xs text-stone-700">{eur(r.advice.htMinor)} HT</span></> : r.error ?? "—"}<span className="mt-1 block max-w-48 text-xs">{r.advice?.title}</span></td>
                  <td className="text-xs tabular-nums" data-testid="advice-marginrow">{r.margin ? (r.margin.partial ? <>{pctFr(r.margin.prudent.onPriceBps)} <span className="text-stone-700">({eur(r.margin.prudent.grossMinor)})</span><span className="block text-stone-700">prudente : coût incomplet</span></> : <>{pctFr(r.margin.known.onPriceBps)} <span className="text-stone-700">({eur(r.margin.known.grossMinor)})</span></>) : "—"}{r.advice?.conflict && <span className="mt-1 block"><StatusBadge tone="err">conflit marge / marché</StatusBadge></span>}</td>
                  <td className="tabular-nums" data-testid="advice-sellers">{r.position.sellers.direct} A · {r.position.sellers.indicative - r.position.sellers.direct} B<span className="block text-xs text-stone-700">{r.position.sellers.context} en contexte</span></td>
                  <td data-testid="advice-status"><StatusBadge tone={STATUS_TONE[r.position.status]}>{ADVICE_STATUS_FR[r.position.status]}</StatusBadge></td>
                  <td className="text-xs">{r.position.lastCheckedAt ? r.position.lastCheckedAt.toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "—"}</td>
                </tr>
                <tr>
                  <td colSpan={9} className="!pt-0">
                    <div className="flex flex-wrap items-start gap-4">
                      <details data-testid="advice-understand" className="min-w-0 flex-1"><summary className="cursor-pointer text-xs font-medium text-brand-700">Comprendre</summary><BenchmarkDetail row={r} vat={2000} />{r.query && <Link className="mt-2 inline-block text-xs underline" href={`/admin/tarifs/comparatif-marche?${r.query}`}>Étude détaillée (coûts, scénarios)</Link>}</details>
                      {r.canPrepare ? (
                        <form action={prepareAdvicePriceAction}><input type="hidden" name="familySlug" value={pr.familySlug} /><input type="hidden" name="config" value={r.key} /><button className="btn-secondary min-h-0 py-1 text-xs" data-testid="advice-prepare">Préparer un brouillon</button></form>
                      ) : (
                        <p className="text-xs text-stone-700" data-testid="advice-prepare-none">Préparer un brouillon : {r.advice && r.current && r.advice.htMinor === r.current.htMinor ? "prix déjà en vigueur" : "aucun prix établi"}</p>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            ))}
          </Table>
          {pr.skipped.length > 0 && <p className="text-xs text-stone-700">Configurations non étudiées : {pr.skipped.join(" ; ")}.</p>}
        </Section>
      ))}
      <p className="text-xs text-stone-700">Prix TTC avec la TVA française validée (20 %) ; un prix concurrent TTC étranger est ramené au HT par le taux normal de son pays, HT/TTC inconnu n'est jamais converti. Marge brute = vente HT − achat net HT, en % du prix de vente HT ; elle ne déduit ni livraison, pose, frais de paiement, acquisition, SAV ni commission et n'est jamais un bénéfice net. Livraison inconnue : produit seul comparé, aucune conclusion sur le coût livré.</p>

      <Section title="Arrondi commercial TTC : terminaison 99 € la plus proche">
        <p className="text-sm" data-testid="rounding-state">Réglage de la politique de coût v{o.policy?.version ?? "—"} : <strong>{rp.active ? "activé" : "désactivé"}</strong> (<Link className="underline" href="/admin/tarifs/comparatif-marche/politique">modifier</Link> ; chaque changement crée une nouvelle version, l'historique est conservé). Ordre : vente HT à la marge cible → TTC → un seul arrondi du total TTC (égalité au supérieur, sous 99 € inchangé) → HT final = TTC ÷ (1 + TVA) au centime, TVA = TTC − HT. Jamais sur un sous-total partiel ni sur chaque composant ; coûts et prix catalogue inchangés.</p>
        <Table caption="Aperçu de l'arrondi des configurations d'appel">
          <thead><tr><th>Produit</th><th>Configuration d'appel</th><th>Prix calculé</th><th>Prix arrondi TTC</th><th>Écart TTC</th><th>HT final · TVA</th><th>Marge réelle</th><th>Signalements</th></tr></thead>
          <tbody>
            {rp.rows.map((r) => (
              <tr key={r.familySlug} data-testid={`rounding-row-${r.familySlug}`}>
                <td className="font-medium">{r.name}</td>
                <td className="max-w-56 text-xs">{r.config}</td>
                <td className="tabular-nums">{eur(r.computedTtcMinor)} TTC<span className="block text-xs text-stone-700">{eur(r.computedHtMinor)} HT</span></td>
                <td className="tabular-nums"><strong>{eur(r.ttcMinor)} TTC</strong>{r.partial && <span className="block text-xs">sous-total partiel</span>}</td>
                <td className="tabular-nums">{r.adjustmentTtcMinor > 0 ? "+" : ""}{eur(r.adjustmentTtcMinor)}</td>
                <td className="text-xs tabular-nums">{eur(r.htMinor)} HT · {eur(r.vatMinor)} TVA{r.ventilationMinor ? <span className="block text-stone-700">ventilation : {r.ventilationMinor > 0 ? "+" : ""}{eur(r.ventilationMinor)} de TVA (TTC exact)</span> : null}</td>
                <td className="text-xs tabular-nums">{r.margin ? (r.margin.partial ? <>{pctFr(r.margin.prudent.onPriceBps)} ({eur(r.margin.prudent.grossMinor)})<span className="block text-stone-700">prudente : coût incomplet</span></> : <>{pctFr(r.margin.known.onPriceBps)} ({eur(r.margin.known.grossMinor)})</>) : "—"}</td>
                <td className="text-xs">{r.flags.length ? r.flags.join(" ; ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-stone-700">La marge cible s'applique avant arrondi : la marge réelle après arrondi peut être légèrement supérieure ou inférieure. Une grille dont l'arrondi passerait sous le coût d'achat connu n'est jamais publiée automatiquement.</p>
      </Section>

      <Section title="Politique par défaut : grilles à la marge cible">
        <p className="text-sm">Vente HT = achat net HT ÷ (1 − marge cible), achat net = catalogue × (1 − remise) sur les postes éligibles. Bases de calcul : {Object.values(SALE_BASIS_FR).join(" ; ")}. Exceptions commerciales validées : aucune (toutes les grilles de vente suivaient le catalogue × 1 avant cette politique).</p>
        {!preview ? <p className="mt-2 text-sm">Fixez d'abord une marge cible dans la politique de coût.</p> : (
          <div className="mt-3 space-y-3 text-sm" data-testid="default-pricing">
            <p>{preview.rows.length} grille(s) de vente publiée(s) : <strong>{preview.rows.length - toUpdate.length - refused.length}</strong> déjà conforme(s) ou en brouillon, <strong>{toUpdate.length}</strong> à recalculer{refused.length ? <>, <strong>{refused.length}</strong> impossible(s) ({refused.map((r) => `${r.familySlug} : ${r.refused}`).join(" ; ")})</> : null}.</p>
            {toUpdate.length > 0 && <ul className="list-disc pl-5 text-xs">{toUpdate.map((r) => <li key={r.saleId}>{r.familySlug}{r.variantKey ? ` / ${r.variantKey}` : ""} : arrondi {r.rounding.from === "NEAREST_99_TTC" ? "TTC 99 €" : "aucun"} → {r.rounding.to === "NEAREST_99_TTC" ? "TTC 99 €" : "aucun"}, {r.changedCells}/{r.cells} cellule(s){r.sample ? `, ex. ${eur(r.sample.before)} → ${eur(r.sample.after)} HT` : ""} ; suppléments d'éligibilité inconnue conservés : {r.supplements.unknown_kept.length}</li>)}</ul>}
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
