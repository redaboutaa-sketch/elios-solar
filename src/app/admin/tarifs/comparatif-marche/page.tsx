import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { BASIS_FR, CONFIDENCE_FR, COST_BASE_FR, DIRECT_COST_FR, DIRECT_COST_KEYS, SCOPE_FR, SCOPE_KEYS, SCOPE_STATUS_FR, roundingFr } from "@/domain/market";
import { MOUNTING_FR, type SystemMounting } from "@/domain/system";
import { prisma } from "@/lib/prisma";
import { familiesInfo } from "@/server/tariffs/queries";
import { studyInputFrom } from "@/server/market/form";
import { listProposals } from "@/server/market/proposals";
import { study } from "@/server/market/study";
import { archiveProposalAction, createProposalAction, draftGridAction } from "@/server/actions/admin/market";
import { fmtMm, variantLabel } from "../labels";
import { ComparabilityBadge, MarketNote, MOUNTING_OBS_FR, PRICE_KIND_FR, SubNav, eur, pctFr } from "./labels";
import { PriceSimulator } from "./price-simulator";

export const metadata: Metadata = { title: "Comparatif marché" };

const FAMILIES_ORDER = ["malaga", "marbella", "sevilla"];

export default async function MarketPage(props: PageProps<"/admin/tarifs/comparatif-marche">) {
  await requireRole(["ADMIN"]);
  const sp = await props.searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) for (const x of Array.isArray(v) ? v : v != null ? [v] : []) q.append(k, x);
  q.delete("ok");
  q.delete("err");
  const str = (k: string) => q.get(k) ?? "";
  const fams = (await familiesInfo()).sort((a, b) => (FAMILIES_ORDER.indexOf(a.slug) + 1 || 99) - (FAMILIES_ORDER.indexOf(b.slug) + 1 || 99));
  const familySlug = str("produit") || "marbella";
  const fam = await prisma.productFamily.findUnique({ where: { slug: familySlug }, select: { name: true, systemRules: true } });
  const rules = fam?.systemRules as { mountings?: { code: SystemMounting }[]; controls?: { code: string; label: string }[]; options?: { code: string; label: string; values?: { code: string; label: string }[] }[]; finishes?: { code: string; label: string }[]; dims?: { depth?: { label: string }; height?: { label: string } } } | null;
  const mountings = (rules?.mountings ?? []).map((m) => m.code);
  const grids = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", familySlug, nature: "SALE", status: { not: "REJECTED" } }, orderBy: [{ sourceKey: "asc" }, { version: "desc" }], select: { id: true, version: true, variantKey: true, status: true } });
  const input = studyInputFrom(q);
  const r = input ? await study(input) : null;
  const proposals = await listProposals(familySlug);
  const options = q.getAll("option");
  const query = q.toString();
  const ok = r && !("error" in r) ? r : null;
  const costs = ok?.costs ?? [];
  return (
    <div className="space-y-6">
      <PageTitle title="Comparatif marché" backHref="/admin/tarifs" backLabel="Tarifs">
        <div className="flex flex-wrap gap-2">
          {input && <a className="btn-secondary" href={`/admin/tarifs/comparatif-marche/export?type=simulation&${query}`} data-testid="export-simulation">Exporter la simulation (CSV)</a>}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement d'un fichier CSV (route), pas une page */}
          <a className="btn-ghost" href="/admin/tarifs/comparatif-marche/export?type=propositions">Exporter les propositions (CSV)</a>
        </div>
      </PageTitle>
      <SubNav current="etude" />
      <Flash searchParams={props.searchParams} />
      <MarketNote />

      <Section title="Configuration étudiée">
        <form method="get" className="grid gap-3 text-sm md:grid-cols-4" data-testid="market-config">
          <label className="flex flex-col">Produit<select name="produit" className="input" defaultValue={familySlug}>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
          <label className="flex flex-col">Implantation<select name="pose" className="input" defaultValue={str("pose")}>{mountings.map((m) => <option key={m} value={m}>{MOUNTING_FR[m]}</option>)}</select></label>
          <label className="flex flex-col">Largeur (mm)<input name="largeur" className="input" inputMode="numeric" required defaultValue={str("largeur")} /></label>
          <label className="flex flex-col">{rules?.dims?.depth?.label ?? rules?.dims?.height?.label ?? "Avancée"} (mm)<input name="cote" className="input" inputMode="numeric" required defaultValue={str("cote")} /></label>
          {rules?.finishes?.length ? <label className="flex flex-col">Teinte<select name="teinte" className="input" defaultValue={str("teinte")}><option value="">par défaut</option>{rules.finishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></label> : null}
          {rules?.controls?.length ? <label className="flex flex-col">Commande<select name="commande" className="input" defaultValue={str("commande")}><option value="">par défaut</option>{rules.controls.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label> : null}
          <label className="flex flex-col">Marché<select name="pays" className="input" defaultValue={str("pays") || "FR"}><option value="FR">France (TVA 20 % validée)</option><option value="BE">Belgique (TVA non validée : prix TTC non convertis)</option></select></label>
          <label className="flex flex-col md:col-span-2">Version de vente (vide = en vigueur ; un brouillon peut être étudié)<select name="version" className="input" defaultValue={str("version")}><option value="">Version en vigueur</option>{grids.map((g) => <option key={g.id} value={g.id}>{variantLabel(g.variantKey)} v{g.version} ({g.status})</option>)}</select></label>
          <label className="flex items-center gap-2 self-end"><input type="checkbox" name="anciens" value="1" defaultChecked={str("anciens") === "1"} /> Inclure les relevés anciens</label>
          {rules?.options?.length ? <fieldset className="md:col-span-4"><legend>Options</legend><div className="flex flex-wrap gap-3">{rules.options.map((o) => o.values?.length
            ? <label key={o.code} className="flex items-center gap-1 text-xs">{o.label}<select name="option" className="input min-h-0 py-0.5 text-xs" defaultValue={options.find((x) => x === o.code || x.startsWith(`${o.code}=`)) ?? ""}><option value="">aucune</option><option value={o.code}>à choisir</option>{o.values.map((v) => <option key={v.code} value={`${o.code}=${v.code}`}>{v.label}</option>)}</select></label>
            : <label key={o.code} className="flex items-center gap-1 text-xs"><input type="checkbox" name="option" value={o.code} defaultChecked={options.includes(o.code)} /> {o.label}</label>)}</div></fieldset> : null}
          <fieldset className="md:col-span-4"><legend>Périmètre de notre panier (déduit de la configuration ; modifiable)</legend>
            <div className="flex flex-wrap gap-3">{SCOPE_KEYS.map((k) => <label key={k} className="flex flex-col text-xs">{SCOPE_FR[k]}<select name={`p_${k}`} className="input min-h-0 py-1" defaultValue={str(`p_${k}`) || (ok?.ours[k] ?? "")}><option value="">déduit</option><option value="included">inclus</option><option value="extra">hors prix (devis séparé / option)</option><option value="absent">absent</option></select></label>)}</div>
          </fieldset>
          <details className="md:col-span-4" open={str("couts") === "1"}>
            <summary className="cursor-pointer">Coûts directs de cette simulation (sinon ceux de la politique en vigueur)</summary>
            <p className="mt-1 text-xs text-stone-700">Cochez « utiliser ces coûts » pour remplacer ceux de la politique. Un coût inconnu n'est jamais compté comme zéro.</p>
            <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" name="couts" value="1" defaultChecked={str("couts") === "1"} /> utiliser ces coûts</label>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {DIRECT_COST_KEYS.map((key) => {
                const c = costs.find((x) => x.key === key);
                const v = c?.mode === "percent" ? (c.percentBps != null ? (c.percentBps / 100).toString().replace(".", ",") : "") : c?.amountMinor != null ? (c.amountMinor / 100).toFixed(2).replace(".", ",") : "";
                return (
                  <fieldset key={key} className="rounded border border-sand-200 p-2 text-xs"><legend>{DIRECT_COST_FR[key]}</legend>
                    <select name={`c_${key}_s`} className="input min-h-0 py-1" defaultValue={str(`c_${key}_s`) || c?.status || "unknown"}><option value="known">renseigné</option><option value="unknown">inconnu</option><option value="na">sans objet</option></select>
                    <select name={`c_${key}_m`} className="input min-h-0 py-1" defaultValue={str(`c_${key}_m`) || c?.mode || "fixed"}><option value="fixed">montant HT (€)</option><option value="percent">pourcentage</option></select>
                    <input name={`c_${key}_v`} className="input min-h-0 py-1" placeholder="valeur" defaultValue={str(`c_${key}_v`) || v} />
                    <select name={`c_${key}_b`} className="input min-h-0 py-1" defaultValue={str(`c_${key}_b`) || c?.base || "sale_ht"}>{Object.entries(COST_BASE_FR).map(([b, l]) => <option key={b} value={b}>assiette : {l}</option>)}</select>
                    <label className="flex items-center gap-1"><input type="checkbox" name={`c_${key}_f`} value="1" defaultChecked={str("couts") === "1" ? str(`c_${key}_f`) === "1" : !!c?.billedToClient} /> facturé au client à part</label>
                  </fieldset>
                );
              })}
            </div>
          </details>
          <label className="flex flex-col md:col-span-2">Justification d'un positionnement premium (différences vérifiables, sources)<input name="premium" className="input" defaultValue={str("premium")} /></label>
          <div className="md:col-span-4"><button className="btn-primary" type="submit">Étudier</button> <span className="text-xs text-stone-700">Changer de produit : choisissez-le puis « Étudier » pour actualiser implantations et options.</span></div>
        </form>
      </Section>

      {r && "error" in r && <Section><p className="text-danger">{r.error}</p></Section>}
      {ok && <Study r={ok} query={query} />}

      <Section title="Propositions de prix en brouillon">
        <div id="propositions" />
        {proposals.length ? (
          <Table caption="Propositions">
            <thead><tr><th>Date</th><th>Configuration</th><th>Version tarifaire</th><th>Actuel HT</th><th>Proposé HT / TTC</th><th>Scénario</th><th>Confiance</th><th>Brouillon de grille</th><th></th></tr></thead>
            <tbody data-testid="proposals">
              {proposals.map((p) => {
                const c = p.config as { mounting: string; widthMm: number; dimMm: number; options?: string[] };
                const snap = p.snapshot as { confidence?: keyof typeof CONFIDENCE_FR | null };
                return (
                  <tr key={p.id} className={p.status === "ARCHIVED" ? "opacity-60" : ""}>
                    <td>{fmtDate(p.createdAt)}<div className="text-xs">{p.createdBy}</div></td>
                    <td>{fmtMm(c.widthMm)} × {fmtMm(c.dimMm)} · {MOUNTING_FR[c.mounting as SystemMounting] ?? c.mounting}{c.options?.length ? ` · ${c.options.join(", ")}` : ""}</td>
                    <td>{p.priceListId ? <Link className="underline" href={`/admin/tarifs/grilles/${p.priceListId}`}>{variantLabel(p.variantKey)} v{p.priceListVersion}</Link> : "—"}</td>
                    <td>{eur(p.currentHtMinor)}</td>
                    <td>{eur(p.proposedHtMinor)} / {eur(p.proposedTtcMinor)}</td>
                    <td>{p.scenario}{p.justification ? <div className="text-xs">{p.justification}</div> : null}</td>
                    <td className="text-xs">{snap.confidence ? CONFIDENCE_FR[snap.confidence] : "—"}</td>
                    <td>{p.gridDraftId ? <Link className="underline" href={`/admin/tarifs/grilles/${p.gridDraftId}`}>ouvrir le brouillon</Link> : p.status === "ACTIVE" ? <form action={draftGridAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="query" value={query} /><button className="btn-secondary min-h-0 py-1 text-xs" type="submit" data-testid="draft-grid">Créer un brouillon de grille (une cellule)</button></form> : "—"}</td>
                    <td>{p.status === "ACTIVE" ? <form action={archiveProposalAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="query" value={query} /><button className="btn-ghost min-h-0 py-1 text-xs" type="submit">Archiver</button></form> : <StatusBadge tone="neutral">archivée</StatusBadge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : <p className="text-sm text-stone-700">Aucune proposition pour ce produit.</p>}
        <p className="mt-2 text-xs text-stone-700">Le brouillon de grille reprend la version de vente utilisée et ne modifie que la cellule de la configuration étudiée (aucune extrapolation au reste de la grille). Pour une règle sur toute la grille, utilisez « Recalculer » et « Comparer » dans la grille, qui affichent les cellules affectées. La vérification et la publication restent manuelles.</p>
      </Section>
    </div>
  );
}

type StudyOk = Extract<Awaited<ReturnType<typeof study>>, { sim: unknown }>;

function Study({ r, query }: { r: StudyOk; query: string }) {
  const { sim, cost, current, policy } = r;
  const missingPolicy = !policy;
  return (
    <>
      <Section title="Version tarifaire et prix actuel">
        {missingPolicy && <p className="mb-2 text-sm text-danger" data-testid="no-policy">Aucune politique de coût en vigueur : définissez la remise revendeur et sa date d'effet dans <Link className="underline" href="/admin/tarifs/comparatif-marche/politique">Politique de coût</Link>.</p>}
        <ul className="text-sm" data-testid="market-versions">
          <li>Vente : {r.usedSale ? <Link className="underline" href={`/admin/tarifs/grilles/${r.usedSale.id}`}>{r.usedSale.sourceKey} v{r.usedSale.version}</Link> : "aucune grille de vente en vigueur (prix sur devis)"}{sim.saleCell ? ` · cellule ${fmtMm(sim.saleCell.dimAmm)} × ${sim.saleCell.widthMinMm === sim.saleCell.widthMaxMm ? fmtMm(sim.saleCell.widthMaxMm) : `${fmtMm(sim.saleCell.widthMinMm)}–${fmtMm(sim.saleCell.widthMaxMm)}`}` : ""}</li>
          <li>Catalogue fournisseur : {sim.supplierUsed.length ? sim.supplierUsed.map((u) => <Link key={u.id} className="mr-2 underline" href={`/admin/tarifs/grilles/${u.id}`}>{u.sourceKey} v{u.version}</Link>) : "aucune grille catalogue"}</li>
          <li>Politique de coût : {policy ? <>v{policy.version}, effet le {fmtDate(policy.validFrom, false)} — remise revendeur {pctFr(policy.discountBps)} (paramètre de coût interne, jamais une remise client)</> : "non définie"}</li>
        </ul>
        {!sim.price && <p className="mt-2 text-sm">Pas de prix de grille pour cette configuration (cote hors grille ou implantation non tarifée) : étude des comparables seulement.</p>}
      </Section>

      {sim.price && (
        <Section title="Prix, coût d'achat net et marges">
          <Table caption="Synthèse">
            <tbody data-testid="market-summary">
              <tr><th>A. Prix catalogue fournisseur HT</th><td>{sim.supplierBreakdown ? <>{eur(sim.supplierBreakdown.totalMinor)}{sim.supplierBreakdown.partial ? " (partiel : éléments à chiffrer)" : ""}</> : "aucune grille catalogue"}</td></tr>
              <tr><th>B. Coût d'achat net HT</th><td data-testid="net-cost">{cost ? <>{eur(cost.knownNetMinor)} établi{cost.partial ? <> · <strong>partiel</strong> — hypothèse prudente {eur(cost.prudentNetMinor)} (postes inconnus au prix catalogue sans remise)</> : ""}</> : missingPolicy ? "non établi : politique de coût absente" : "non établi"}</td></tr>
              <tr><th>C. Prix de vente actuel HT</th><td data-testid="current-ht">{r.sale ? <>{eur(r.sale.totalMinor)}{r.sale.partial ? " — sous-total partiel" : ""}</> : "—"}</td></tr>
              <tr><th>D. Prix public TTC</th><td>{r.sale?.totalTtcMinor != null ? <>{eur(r.sale.totalTtcMinor)} (TVA {pctFr(r.sale.vatRateBps)}, France)</> : "—"}</td></tr>
              {current && <>
                <tr><th>Marge brute produit</th><td data-testid="gross-margin">{eur(current.known.grossMinor)} sur coûts établis{cost?.partial ? <> ; {eur(current.prudent.grossMinor)} en hypothèse prudente</> : ""}</td></tr>
                <tr><th>Marge brute en % du prix de vente</th><td>{pctFr(current.known.onPriceBps)}{cost?.partial ? ` (prudente : ${pctFr(current.prudent.onPriceBps)})` : ""}</td></tr>
                <tr><th>Taux de marge sur coût d'achat</th><td>{pctFr(current.known.onCostBps)}{cost?.partial ? ` (prudent : ${pctFr(current.prudent.onCostBps)})` : ""}</td></tr>
                <tr><th>Contribution estimée après coûts directs</th><td data-testid="contribution">{eur(current.contribution.contributionMinor)} ({pctFr(current.contribution.onPriceBps)}){current.contribution.partial ? <> — <strong>partielle</strong> : {current.contribution.missing.join(", ")} (jamais un bénéfice net)</> : null}</td></tr>
              </>}
            </tbody>
          </Table>
          {cost && (
            <>
              <h3 className="mt-4 font-medium">Coût d'achat poste par poste</h3>
              <Table caption="Coût d'achat net">
                <thead><tr><th>Poste</th><th>Catalogue HT</th><th>Achat net HT</th><th>Base</th></tr></thead>
                <tbody data-testid="cost-lines">{cost.lines.map((l) => <tr key={l.code}><td>{l.label}</td><td>{eur(l.catalogueMinor)}</td><td>{l.netMinor != null ? eur(l.netMinor) : <StatusBadge tone="warn">non établi</StatusBadge>}</td><td className="text-xs">{BASIS_FR[l.basis]}{l.note ? ` — ${l.note}` : ""}</td></tr>)}</tbody>
              </Table>
              <p className="mt-1 text-xs text-stone-700">Ordre : structure remisée ; pourcentages calculés sur la structure après remise (liste de prix, « % du prix du système après application de la remise ») ; montants fixes remisés seulement si déclarés éligibles dans la politique ; la remise n'est jamais appliquée deux fois.</p>
            </>
          )}
          {current && (
            <>
              <h3 className="mt-4 font-medium">Coûts directs (contribution)</h3>
              <Table caption="Coûts directs">
                <thead><tr><th>Coût</th><th>Montant</th><th>Traitement</th></tr></thead>
                <tbody data-testid="direct-costs">{current.contribution.costs.map((c) => <tr key={c.key}><td>{c.label}</td><td>{c.computedMinor != null ? eur(c.computedMinor) : "—"}</td><td className="text-xs">{c.explanation}{c.note ? ` — ${c.note}` : ""}</td></tr>)}</tbody>
              </Table>
              <p className="mt-1 text-xs text-stone-700">Facturé au client : livraison et pose sont chiffrées séparément au devis (hors prix du produit). Reste à notre charge : les coûts renseignés non refacturés. La commission est simulée sur l'assiette indiquée.</p>
            </>
          )}
        </Section>
      )}

      {sim.price && cost && r.vat != null && (
        <Section title="Simuler un nouveau prix">
          <PriceSimulator initialHtMinor={r.reco?.recommended?.htMinor ?? r.saleHt} knownCostMinor={cost.knownNetMinor} prudentCostMinor={cost.prudentNetMinor} costPartial={cost.partial} vatRateBps={r.vat} costs={r.costs} floorHtMinor={r.floor?.floorHtMinor ?? null} currentHtMinor={r.saleHt} />
        </Section>
      )}

      <Section title={`Offres concurrentes (${r.evals.length})`}>
        <p className="text-sm" data-testid="market-stats">{r.stats.n ? <>Retenues : <strong>{r.stats.n}</strong> offre(s) fortement comparable(s), {r.stats.independent} source(s) indépendante(s), relevées du {fmtDate(r.stats.dates.from, false)} au {fmtDate(r.stats.dates.to, false)} — fourchette {eur(r.stats.minMinor)} à {eur(r.stats.maxMinor)} HT, médiane {eur(r.stats.medianMinor)} HT.</> : "Aucune offre retenue pour cette configuration (périmètre, dimensions, comparabilité, base fiscale ou ancienneté)."} Seuil d'ancienneté : {r.ctx.staleDays} j ; tolérance de dimensions : {pctFr(r.ctx.dimToleranceBps)} par côté.</p>
        {r.position && <p className="mt-1 text-sm" data-testid="market-position">Prix actuel : {r.position.vsMedianBps >= 0 ? "+" : ""}{pctFr(r.position.vsMedianBps)} par rapport à la médiane ; {r.position.below} offre(s) moins chère(s), {r.position.above} plus chère(s).</p>}
        <Table caption="Offres et écarts">
          <thead><tr><th>Revendeur / modèle</th><th>Relevé</th><th>Configuration</th><th>Prix constaté</th><th>Comparable HT</th><th>Comparabilité</th><th>Écarts poste par poste</th><th>Statut</th></tr></thead>
          <tbody data-testid="market-offers">
            {[...r.evals].sort((a, b) => Number(b.retained) - Number(a.retained)).map((e) => (
              <tr key={e.obs.id}>
                <td><a className="underline" href={e.obs.url} target="_blank" rel="noopener noreferrer nofollow">{e.obs.retailer}</a><div className="text-xs">{e.obs.model}</div><Link className="text-xs underline" href={`/admin/tarifs/comparatif-marche/releves/${e.obs.id}`}>détail</Link></td>
                <td className="text-xs">{fmtDate(e.obs.observedAt, false)} · {e.obs.country}{e.stale ? <> <StatusBadge tone="warn">ancien</StatusBadge></> : null}</td>
                <td className="text-xs">{e.obs.widthMm && e.obs.depthMm ? `${fmtMm(e.obs.widthMm)} × ${fmtMm(e.obs.depthMm)}` : "—"} · {MOUNTING_OBS_FR[e.obs.mounting]}{e.dimsMatch === "swapped" ? " (cotes inversées)" : ""}</td>
                <td className="text-xs">{eur(e.obs.priceMinor)} {e.obs.taxBasis === "UNKNOWN" ? "HT/TTC ?" : e.obs.taxBasis}{e.obs.regularPriceMinor ? ` (normal ${eur(e.obs.regularPriceMinor)})` : ""} · {PRICE_KIND_FR[e.obs.priceKind]}</td>
                <td>{e.comparableHtMinor != null ? eur(e.comparableHtMinor) : e.baseHtMinor != null ? <span className="text-xs">{eur(e.baseHtMinor)} non normalisé</span> : "—"}</td>
                <td><ComparabilityBadge value={e.obs.comparability} /></td>
                <td className="text-xs">{e.gaps.length ? <ul>{e.gaps.map((g) => <li key={g.key}>{SCOPE_FR[g.key]} : nous {g.ours === "included" ? "inclus" : g.ours === "extra" ? "hors prix" : "absent"} / eux {SCOPE_STATUS_FR[g.theirs]}{g.normalizedMinor != null ? ` → +${eur(g.normalizedMinor)}` : ""} ({g.note})</li>)}</ul> : "périmètre équivalent"}</td>
                <td className="text-xs">{e.retained ? <StatusBadge tone="ok">retenue</StatusBadge> : <><StatusBadge tone="neutral">présentée séparément</StatusBadge><ul className="mt-1">{e.reasons.map((x) => <li key={x}>{x}</li>)}</ul></>}</td>
              </tr>
            ))}
            {!r.evals.length && <tr><td colSpan={8}>Aucun relevé pour ce produit. <Link className="underline" href="/admin/tarifs/comparatif-marche/releves">Ajouter un relevé</Link>.</td></tr>}
          </tbody>
        </Table>
        <p className="mt-1 text-xs text-stone-700">Un écart de périmètre n'est normalisé que si son montant est vérifiable ; aucune normalisation au m². Un « à partir de », une promotion sans prix normal ou un prix sans dimensions ne pilote pas la recommandation. Qualité non déduite du visuel ni du prix.</p>
      </Section>

      <Section title="Recommandation">
        {!r.reco ? <p className="text-sm">{!policy ? "Politique de coût absente : plancher et recommandation impossibles." : !cost ? "Coût d'achat non établi (aucune grille catalogue pour cette configuration) : pas de plancher." : "TVA du marché étudié non validée : pas de recommandation en prix TTC."}</p> : (
          <div className="space-y-3 text-sm" data-testid="recommendation">
            <p data-testid="floor">Plancher : {r.floor?.floorHtMinor != null ? <strong>{eur(r.floor.floorHtMinor)} HT</strong> : <strong>non défini</strong>} — {r.floor?.reason}{r.floor?.targetBps != null ? ` (${pctFr(r.floor.targetBps)})` : ""}. Coûts pris en compte : {r.floor?.counted.join(", ")}.{r.floor?.missing.length ? <> Coûts manquants : {r.floor.missing.join(", ")}.</> : null}</p>
            <Table caption="Scénarios">
              <thead><tr><th>Scénario</th><th>Règle</th><th>Prix HT</th><th>Observations</th></tr></thead>
              <tbody data-testid="scenarios">{r.reco.scenarios.map((s) => <tr key={s.key}><td>{s.label}</td><td className="text-xs">{s.rule}</td><td>{eur(s.htMinor)}</td><td className="text-xs">{s.belowFloor ? <StatusBadge tone="err">sous le plancher</StatusBadge> : null} {s.key === "premium" && !s.supported ? <StatusBadge tone="warn">non étayé</StatusBadge> : null} {s.note}</td></tr>)}</tbody>
            </Table>
            {r.reco.recommended && r.recommended ? (
              <p data-testid="recommended">Prix conseillé : <strong>{eur(r.recommended.htMinor)} HT · {eur(r.recommended.ttcMinor)} TTC</strong> (scénario aligné, arrondi {roundingFr(policy!.rounding)}){r.saleHt ? <> ; variation {r.recommended.htMinor >= r.saleHt ? "+" : ""}{eur(r.recommended.htMinor - r.saleHt)} ({pctFr(Math.round(((r.recommended.htMinor - r.saleHt) * 10_000) / r.saleHt))})</> : null} ; marge brute {eur(r.recommended.known.grossMinor)} ({pctFr(r.recommended.known.onPriceBps)}) ; contribution {eur(r.recommended.contribution.contributionMinor)}{r.recommended.contribution.partial ? " (partielle)" : ""} ; confiance : {CONFIDENCE_FR[r.reco.confidence]}.</p>
            ) : <p data-testid="no-recommendation">Aucun prix conseillé. Confiance : {CONFIDENCE_FR[r.reco.confidence]}.</p>}
            {r.reco.gapToFloorMinor != null && <p className="text-danger">Écart médiane du marché → plancher : {eur(r.reco.gapToFloorMinor)} HT.</p>}
            {r.reco.messages.length > 0 && <ul className="list-disc pl-5">{r.reco.messages.map((m) => <li key={m}>{m}</li>)}</ul>}
            <p className="text-xs text-stone-700">La recommandation porte sur cette seule configuration ; elle n'est pas extrapolée au reste de la grille.</p>
          </div>
        )}
        {sim.price && r.usedSale && r.vat != null && (
          <form action={createProposalAction} className="mt-4 flex flex-wrap items-end gap-3 text-sm" data-testid="proposal-form">
            <input type="hidden" name="query" value={query} />
            <label className="flex flex-col">Scénario<select name="scenario" className="input min-h-0 py-1" defaultValue={r.reco?.recommended ? "aligned" : "manuel"}><option value="competitive">Compétitif</option><option value="aligned">Aligné marché</option><option value="premium">Premium</option><option value="manuel">Prix saisi (simulation interne)</option></select></label>
            <label className="flex flex-col">Prix proposé HT (€)<input name="proposedHt" className="input min-h-0 py-1" inputMode="decimal" required defaultValue={r.recommended ? (r.recommended.htMinor / 100).toFixed(2).replace(".", ",") : ""} /></label>
            <label className="flex min-w-64 flex-1 flex-col">Justification<input name="justification" className="input min-h-0 py-1" defaultValue={r.ctx && query.includes("premium=") ? new URLSearchParams(query).get("premium") ?? "" : ""} /></label>
            <button className="btn-secondary min-h-0 py-1.5" type="submit">Préparer la proposition (brouillon)</button>
          </form>
        )}
      </Section>
    </>
  );
}
