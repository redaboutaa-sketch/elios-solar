import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { PageTitle, Section, StatusBadge, Table } from "@/components/admin/ui";
import { CLIENTELE_LABEL, formatAmount, type Clientele } from "@/domain/tariffs";
import { MOUNTING_FR, type SystemMounting } from "@/domain/system";
import { prisma } from "@/lib/prisma";
import { familiesInfo, simulate } from "@/server/tariffs/queries";
import { netCostOf } from "@/domain/market";
import { policyAt } from "@/server/market/policy";
import { ConfidentialNote, fmtMm, variantLabel } from "../labels";

export const metadata: Metadata = { title: "Simulateur de prix" };

const REASON_FR: Record<string, string> = { no_table: "aucune grille de vente en vigueur pour ce produit (à cette date, pour cette clientèle)", incomplete: "configuration incomplète ou variante sans grille (implantation non tarifée)", out_of_grid: "cote absente de la grille (aucune interpolation ; lecture exacte sauf règle confirmée) : devis" };

export default async function SimulatorPage(props: PageProps<"/admin/tarifs/simulateur">) {
  await requireRole(["ADMIN"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const fams = await familiesInfo();
  const familySlug = str("produit") || fams[0]?.slug || "";
  const fam = familySlug ? await prisma.productFamily.findUnique({ where: { slug: familySlug }, select: { systemRules: true } }) : null;
  const mountings = ((fam?.systemRules as { mountings?: { code: SystemMounting }[] } | null)?.mountings ?? []).map((m) => m.code);
  const grids = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", familySlug, nature: "SALE" }, orderBy: [{ sourceKey: "asc" }, { version: "desc" }], select: { id: true, version: true, variantKey: true, status: true } });
  const run = str("largeur") && str("cote");
  const at = str("date") ? new Date(str("date")) : new Date();
  const optionCodes = Array.isArray(sp.option) ? (sp.option as string[]) : typeof sp.option === "string" ? [sp.option] : [];
  const sim = run ? await simulate({ familySlug, mounting: (str("pose") || mountings[0] || "wall") as SystemMounting, widthMm: Math.round(Number(str("largeur"))), dimMm: Math.round(Number(str("cote"))), clientele: (str("clientele") || "PARTICULIER") as Clientele, at: Number.isNaN(at.getTime()) ? new Date() : at, versionId: str("version") || null, finishCode: str("teinte") || null, controlCode: str("commande") || null, options: optionCodes }) : null;
  const policy = sim && !("error" in sim) ? await policyAt(Number.isNaN(at.getTime()) ? new Date() : at) : null;
  const net = sim && !("error" in sim) && sim.supplierBreakdown && policy ? netCostOf(sim.supplierBreakdown, sim.supplierSupplements, policy) : null;
  const rulesInfo = fam?.systemRules as { finishes?: { code: string; label: string }[]; customFinish?: { code: string; label: string }; controls?: { code: string; label: string }[]; options?: { code: string; label: string }[] } | null;
  return (
    <div className="space-y-6">
      <PageTitle title="Simulateur de prix" backHref="/admin/tarifs" backLabel="Tarifs" />
      <ConfidentialNote />
      <Section title="Configuration">
        <form method="get" className="grid gap-3 text-sm md:grid-cols-4">
          <label className="flex flex-col">Produit<select name="produit" className="input" defaultValue={familySlug}>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></label>
          <label className="flex flex-col">Pose<select name="pose" className="input" defaultValue={str("pose")}>{mountings.map((m) => <option key={m} value={m}>{MOUNTING_FR[m]}</option>)}</select></label>
          <label className="flex flex-col">Largeur (mm)<input name="largeur" className="input" inputMode="numeric" required defaultValue={str("largeur")} /></label>
          <label className="flex flex-col">Projection, avancée ou hauteur (mm)<input name="cote" className="input" inputMode="numeric" required defaultValue={str("cote")} /></label>
          <label className="flex flex-col">Clientèle<select name="clientele" className="input" defaultValue={str("clientele") || "PARTICULIER"}>{Object.entries(CLIENTELE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="flex flex-col">Date d'évaluation<input type="datetime-local" name="date" className="input" defaultValue={str("date")} /></label>
          <label className="flex flex-col">Teinte<select name="teinte" className="input" defaultValue={str("teinte")}><option value="">par défaut</option>{[...(rulesInfo?.finishes ?? []), ...(rulesInfo?.customFinish ? [rulesInfo.customFinish] : [])].map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}</select></label>
          {rulesInfo?.controls?.length ? <label className="flex flex-col">Commande<select name="commande" className="input" defaultValue={str("commande")}><option value="">par défaut</option>{rulesInfo.controls.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></label> : null}
          {rulesInfo?.options?.length ? <fieldset className="md:col-span-4"><legend className="text-sm">Options</legend><div className="flex flex-wrap gap-3">{rulesInfo.options.map((o) => <label key={o.code} className="flex items-center gap-1 text-xs"><input type="checkbox" name="option" value={o.code} defaultChecked={optionCodes.includes(o.code)} /> {o.label}</label>)}</div></fieldset> : null}
          <label className="flex flex-col md:col-span-2">Version (vide = celle qui serait en vigueur ; un brouillon peut être simulé)<select name="version" className="input" defaultValue={str("version")}><option value="">Version en vigueur</option>{grids.map((g) => <option key={g.id} value={g.id}>{variantLabel(g.variantKey)} v{g.version} ({g.status})</option>)}</select></label>
          <div className="md:col-span-4"><button className="btn-primary" type="submit">Simuler</button> <span className="text-xs text-stone-700">Changer de produit : choisissez-le puis « Simuler » pour actualiser les poses.</span></div>
        </form>
      </Section>
      {sim && "error" in sim && <Section><p className="text-danger">{sim.error}</p></Section>}
      {sim && !("error" in sim) && (
        <>
          <Section title="Version tarifaire utilisée">
            {sim.used.length ? (
              <ul className="text-sm" data-testid="sim-versions">{sim.used.map((u) => <li key={u.id}><Link className="underline" href={`/admin/tarifs/grilles/${u.id}`}>{u.sourceKey} v{u.version}</Link> — {variantLabel(u.variantKey)}, {CLIENTELE_LABEL[u.clientele as Clientele]}, {u.currency ?? "?"} {u.taxBasis}, lecture {u.dimRule === "ROUND_UP" ? "à la dimension supérieure" : "exacte"}{u.status !== "ACTIVE" ? <> <StatusBadge tone="warn">{u.status} — simulation seulement</StatusBadge></> : null}</li>)}</ul>
            ) : <p className="text-sm">Aucune version : {REASON_FR.no_table}.</p>}
          </Section>
          <Section title="Détail du calcul">
            <div data-testid="sim-result">
              {sim.price ? (
                <Table caption="Détail du calcul">
                  <tbody>
                    <tr><th>Cote saisie</th><td>{fmtMm(sim.input.widthMm)} × {fmtMm(sim.input.depthMm ?? sim.input.heightMm ?? 0)} ({sim.rules.dimLabel.toLowerCase()}), pose {MOUNTING_FR[sim.input.mounting]}</td></tr>
                    <tr><th>Cellule retenue</th><td>variante « {sim.price.variantKey || "unique"} » · {sim.price.grid.dimLabel} {fmtMm(sim.price.grid.dimMm)} × largeur {fmtMm(sim.price.grid.widthMm)}{sim.price.roundedUp ? " (dimension supérieure, règle de la grille)" : " (cote de la grille)"}</td></tr>
                    <tr><th>Prix de la grille</th><td><strong data-testid="sim-amount">{formatAmount(sim.price.amountMinor, sim.price.currency)}</strong> {sim.price.taxBasis}</td></tr>
                    <tr><th>TVA</th><td>{sim.vatRateBps != null ? `${(sim.vatRateBps / 100).toLocaleString("fr-FR")} %` : "—"} {sim.vatFromCatalog ? "(taux du catalogue)" : "(taux de la grille)"}</td></tr>
                    <tr><th>Prix TTC</th><td>{formatAmount(sim.ttcMinor, sim.price.currency)} {sim.price.taxBasis === "HT" ? "= HT + TVA arrondie au centime" : "(montant TTC de la grille)"}</td></tr>
                  </tbody>
                </Table>
              ) : <p className="text-sm">Pas de prix de grille : {REASON_FR[sim.lookup.ok ? "" : sim.lookup.reason] ?? "—"}.</p>}
              {sim.table && <p className="mt-2 text-xs text-stone-700">Cotes tarifées : {sim.rules.dimLabel.toLowerCase()} {sim.table.dims.map(fmtMm).join(", ")} ; largeurs {sim.table.widths.length} colonne(s).</p>}
            </div>
          </Section>
          <Section title="Prix A / B / C / D de cette configuration">
            <Table caption="Natures de prix">
              <tbody data-testid="sim-natures">
                <tr><th>A. Prix catalogue fournisseur HT</th><td>{sim.supplierBreakdown ? <><strong>{formatAmount(sim.supplierBreakdown.totalMinor, sim.supplierBreakdown.currency)}</strong>{sim.supplierBreakdown.partial ? " (partiel)" : ""} — interne, jamais publié</> : "aucune grille catalogue pour cette configuration"}</td></tr>
                <tr><th>B. Prix d'achat net</th><td data-testid="sim-net">{net ? <><strong>{formatAmount(net.knownNetMinor, sim.supplierBreakdown!.currency)}</strong> établi (politique de coût v{policy!.version}, remise revendeur {(policy!.discountBps / 100).toLocaleString("fr-FR")} %){net.partial ? <> — partiel : {[...net.unknown, ...net.missing].map((l) => l.label).join(", ")} non établi(s)</> : ""} — interne ; détail et marges : <Link className="underline" href={`/admin/tarifs/comparatif-marche?produit=${familySlug}&pose=${str("pose") || mountings[0] || "wall"}&largeur=${str("largeur")}&cote=${str("cote")}`}>Comparatif marché</Link></> : !policy ? "non établi : aucune politique de coût en vigueur (Comparatif marché → Politique de coût)" : "non établi : aucune grille catalogue pour cette configuration"}</td></tr>
                <tr><th>C. Prix de vente HELIOSTORES HT</th><td>{sim.result.priceBreakdown ? <><strong data-testid="sim-sale-ht">{formatAmount(sim.result.priceBreakdown.totalMinor, sim.result.priceBreakdown.currency)}</strong>{sim.result.priceBreakdown.partial ? " — sous-total partiel" : ""}</> : "pas de grille de vente applicable"}</td></tr>
                <tr><th>D. Prix public TTC</th><td>{sim.result.priceBreakdown?.totalTtcMinor != null ? <><strong data-testid="sim-sale-ttc">{formatAmount(sim.result.priceBreakdown.totalTtcMinor, sim.result.priceBreakdown.currency)}</strong> (TVA {(sim.result.priceBreakdown.vatRateBps / 100).toLocaleString("fr-FR")} %)</> : "—"}</td></tr>
              </tbody>
            </Table>
            {sim.result.priceBreakdown && (
              <div className="mt-3 text-sm" data-testid="sim-breakdown">
                <ul className="space-y-0.5">{sim.result.priceBreakdown.lines.map((l) => <li key={l.code}>{l.label}{l.detail ? ` (${l.detail})` : ""} : {formatAmount(l.amountMinor, sim.result.priceBreakdown!.currency)}</li>)}</ul>
                {sim.result.priceBreakdown.pending.length > 0 && <ul className="mt-1 list-disc pl-5 text-stone-700">{sim.result.priceBreakdown.pending.map((p) => <li key={p.code}>À chiffrer : {p.label} — {p.reason}</li>)}</ul>}
              </div>
            )}
          </Section>
          <Section title="Évaluation par le moteur de la boutique">
            <p className="text-sm" data-testid="sim-orderable">Commande en ligne : {sim.result.onlineOrder?.ok ? <StatusBadge tone="ok">possible</StatusBadge> : <StatusBadge tone="warn">non — devis</StatusBadge>} {sim.result.onlineOrder?.reasons.join(" ; ")}</p>
            <p className="mt-1 text-xs text-stone-700">Le tarif ne suffit pas : compatibilité, choix à confirmer, options et pose suivent les règles existantes. Statut du produit : {sim.family.status}.</p>
            {sim.result.lines.length > 0 && (
              <Table caption="Lignes évaluées">
                <thead><tr><th>Ligne</th><th>Qté</th><th>PU TTC</th><th>TVA</th></tr></thead>
                <tbody>{sim.result.lines.map((l) => <tr key={l.code}><td>{l.label}<div className="text-xs text-stone-700">{l.code}</div></td><td>{l.qty}</td><td>{formatAmount(l.unitGrossCents, "EUR")}</td><td>{l.taxRateBps / 100} %</td></tr>)}</tbody>
              </Table>
            )}
            {sim.result.issues.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm">{sim.result.issues.map((i) => <li key={i.code + (i.path ?? "")}>{i.severity === "blocking" ? "Bloquant" : i.severity === "review" ? "À confirmer" : "Info"} : {i.message}</li>)}</ul>}
          </Section>
        </>
      )}
    </div>
  );
}
