import { auth } from "@/lib/auth";
import { csvLine } from "@/domain/acquisition";
import { CONFIDENCE_FR, SCOPE_FR } from "@/domain/market";
import { CSV_HEADER, listObservations, observationCsvRow } from "@/server/market/observations";
import { studyInputFrom } from "@/server/market/form";
import { listProposals } from "@/server/market/proposals";
import { study } from "@/server/market/study";

/** Exports CSV internes du comparatif marché : administrateurs seulement (404 sinon), jamais mis en cache. */
export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "ADMIN") return new Response("Introuvable", { status: 404 });
  const q = new URL(req.url).searchParams;
  const type = q.get("type");
  const e = (m: number | null | undefined) => (m == null ? "" : (m / 100).toFixed(2));
  const bps = (b: number | null | undefined) => (b == null ? "" : (b / 100).toFixed(2));
  let lines: string[] = [];
  let name = "comparatif-marche.csv";
  if (type === "releves") {
    const day = (k: string) => { const d = q.get(k) ? new Date(`${q.get(k)}T00:00:00`) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
    const rows = await listObservations({ familySlug: q.get("produit") ?? "", country: q.get("pays") ?? "", comparability: q.get("comparabilite") ?? "", retailer: q.get("revendeur") ?? "", from: day("du"), to: day("au"), status: (q.get("statut") || "ACTIVE") as "ACTIVE" });
    lines = [csvLine(CSV_HEADER), ...rows.map(observationCsvRow)];
    name = `releves-concurrents_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "propositions") {
    const rows = await listProposals();
    lines = [csvLine(["id", "date", "auteur", "statut", "produit", "variante", "configuration", "version tarifaire", "politique", "actuel HT", "proposé HT", "proposé TTC", "scénario", "confiance", "justification", "brouillon de grille"])];
    for (const p of rows) lines.push(csvLine([p.id, p.createdAt.toISOString(), p.createdBy, p.status, p.familySlug, p.variantKey, JSON.stringify(p.config), p.priceListVersion != null ? `v${p.priceListVersion}` : "", p.policyVersionId, e(p.currentHtMinor), e(p.proposedHtMinor), e(p.proposedTtcMinor), p.scenario, (p.snapshot as { confidence?: string }).confidence ?? "", p.justification, p.gridDraftId]));
    name = `propositions-prix_${new Date().toISOString().slice(0, 10)}.csv`;
  } else if (type === "simulation") {
    const input = studyInputFrom(q);
    const r = input ? await study(input) : null;
    if (!r || "error" in r) return new Response("Configuration incomplète", { status: 400 });
    lines.push(csvLine(["section", "élément", "valeur", "détail"]));
    lines.push(csvLine(["configuration", "produit", input!.familySlug, `${input!.mounting} ${input!.widthMm}×${input!.dimMm} mm ${(input!.options ?? []).join(" ")}`]));
    lines.push(csvLine(["configuration", "version de vente", r.usedSale ? `${r.usedSale.sourceKey} v${r.usedSale.version}` : "aucune", ""]));
    lines.push(csvLine(["configuration", "politique de coût", r.policy ? `v${r.policy.version}` : "aucune", r.policy ? `remise ${bps(r.policy.discountBps)} %` : ""]));
    lines.push(csvLine(["prix", "catalogue fournisseur HT", e(r.sim.supplierBreakdown?.totalMinor), r.sim.supplierBreakdown?.partial ? "partiel" : ""]));
    lines.push(csvLine(["prix", "vente actuelle HT", e(r.sale?.totalMinor), r.sale?.partial ? "partiel" : ""]));
    lines.push(csvLine(["prix", "vente actuelle TTC", e(r.sale?.totalTtcMinor), ""]));
    for (const l of r.cost?.lines ?? []) lines.push(csvLine(["coût", l.label, e(l.netMinor), `${l.basis} ; catalogue ${e(l.catalogueMinor)} ; ${l.note}`]));
    lines.push(csvLine(["coût", "achat net établi", e(r.cost?.knownNetMinor), r.cost?.partial ? "partiel" : ""]));
    lines.push(csvLine(["coût", "achat net prudent", e(r.cost?.prudentNetMinor), "postes inconnus au prix catalogue"]));
    for (const [label, ev] of [["actuel", r.current], ["simulé", r.simulated], ["conseillé", r.recommended]] as const) {
      if (!ev) continue;
      lines.push(csvLine([`marge (${label})`, "prix HT / TTC", e(ev.htMinor), e(ev.ttcMinor)]));
      lines.push(csvLine([`marge (${label})`, "marge brute (coûts établis)", e(ev.known.grossMinor), `${bps(ev.known.onPriceBps)} % du prix ; ${bps(ev.known.onCostBps)} % du coût`]));
      lines.push(csvLine([`marge (${label})`, "marge brute (prudente)", e(ev.prudent.grossMinor), `${bps(ev.prudent.onPriceBps)} % du prix`]));
      lines.push(csvLine([`marge (${label})`, "contribution", e(ev.contribution.contributionMinor), ev.contribution.partial ? `partielle : ${ev.contribution.missing.join(", ")}` : ""]));
    }
    lines.push(csvLine(["marché", "offres retenues", r.stats.n, `${r.stats.independent} indépendante(s)`]));
    lines.push(csvLine(["marché", "médiane HT", e(r.stats.medianMinor), `fourchette ${e(r.stats.minMinor)}–${e(r.stats.maxMinor)}`]));
    for (const ev of r.evals) lines.push(csvLine(["offre", `${ev.obs.retailer} — ${ev.obs.model}`, e(ev.comparableHtMinor), `${ev.retained ? "retenue" : "séparée"} ; ${ev.obs.url} ; ${ev.reasons.join(" ; ")} ; ${ev.gaps.map((g) => `${SCOPE_FR[g.key]}: ${g.note}`).join(" ; ")}`]));
    lines.push(csvLine(["recommandation", "plancher HT", e(r.floor?.floorHtMinor), r.floor?.reason ?? ""]));
    for (const s of r.reco?.scenarios ?? []) lines.push(csvLine(["recommandation", s.label, e(s.htMinor), `${s.rule} ; ${s.note}`]));
    lines.push(csvLine(["recommandation", "prix conseillé HT", e(r.reco?.recommended?.htMinor), r.reco ? `confiance ${CONFIDENCE_FR[r.reco.confidence]}` : ""]));
    name = `simulation-${input!.familySlug}-${input!.widthMm}x${input!.dimMm}.csv`;
  } else return new Response("Type d'export inconnu", { status: 400 });
  return new Response(`﻿${lines.join("\r\n")}\r\n`, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "x-robots-tag": "noindex" } });
}
