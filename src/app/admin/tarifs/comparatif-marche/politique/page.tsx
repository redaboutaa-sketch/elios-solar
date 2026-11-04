import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { COST_BASE_FR, DIRECT_COST_FR, DIRECT_COST_KEYS, roundingFr } from "@/domain/market";
import { prisma } from "@/lib/prisma";
import { DEFAULT_DIRECT_COSTS, listPolicies, policyAt } from "@/server/market/policy";
import { createPolicyAction } from "@/server/actions/admin/market";
import { MarketNote, SubNav, eur, pctFr } from "../labels";

export const metadata: Metadata = { title: "Politique de coût" };

/** Postes à montant fixe ou tableau des grilles catalogue fournisseur (les pourcentages suivent l'ordre du catalogue). */
async function supplementPosts() {
  const lists = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", nature: "SUPPLIER_LIST", status: { not: "REJECTED" } }, select: { id: true, familySlug: true } });
  const rows = lists.length ? await prisma.supplierPriceRow.findMany({ where: { listId: { in: lists.map((l) => l.id) }, kind: "FIXED" }, select: { code: true, label: true, familySlug: true, conditions: true } }) : [];
  const out = new Map<string, { code: string; label: string; families: Set<string> }>();
  for (const r of rows) {
    const mode = (r.conditions as { mode?: string } | null)?.mode;
    if (mode === "percent" || mode === "pending") continue;
    const p = out.get(r.code) ?? { code: r.code, label: r.label, families: new Set<string>() };
    p.families.add(r.familySlug);
    out.set(r.code, p);
  }
  return [...out.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export default async function PolicyPage(props: PageProps<"/admin/tarifs/comparatif-marche/politique">) {
  await requireRole(["ADMIN"]);
  const [versions, current, posts] = await Promise.all([listPolicies(), policyAt(), supplementPosts()]);
  const base = current ?? versions[0] ?? null;
  const costs = base?.directCosts ?? DEFAULT_DIRECT_COSTS;
  const elig = base?.eligibility ?? {};
  const val = (bps: number | null | undefined) => (bps == null ? "" : (bps / 100).toString().replace(".", ","));
  return (
    <div className="space-y-6">
      <PageTitle title="Politique de coût" backHref="/admin/tarifs/comparatif-marche" backLabel="Comparatif marché" />
      <SubNav current="politique" />
      <Flash searchParams={props.searchParams} />
      <MarketNote />
      <Section title="Versions">
        <Table caption="Versions de la politique de coût">
          <thead><tr><th>Version</th><th>Effet</th><th>Remise revendeur</th><th>Objectifs</th><th>Ancienneté / tolérance</th><th>Arrondi</th><th>Auteur</th><th>Note</th></tr></thead>
          <tbody data-testid="policy-versions">
            {versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.version} {current?.id === v.id ? <StatusBadge tone="ok">en vigueur</StatusBadge> : v.validFrom > new Date() ? <StatusBadge tone="neutral">programmée</StatusBadge> : null}</td>
                <td>{fmtDate(v.validFrom, false)}</td>
                <td>{pctFr(v.discountBps)}</td>
                <td className="text-xs">marge {v.marginTargetBps != null ? pctFr(v.marginTargetBps) : "non définie"} · contribution {v.contributionTargetBps != null ? pctFr(v.contributionTargetBps) : "non définie"}</td>
                <td className="text-xs">{v.staleDays} j · {pctFr(v.dimToleranceBps)}</td>
                <td className="text-xs">{roundingFr(v.rounding)}</td>
                <td className="text-xs">{v.createdBy ?? "—"}<div>{fmtDate(v.createdAt)}</div></td>
                <td className="text-xs">{v.note}</td>
              </tr>
            ))}
            {!versions.length && <tr><td colSpan={8}>Aucune version : coût d'achat net non établi.</td></tr>}
          </tbody>
        </Table>
      </Section>
      <Section title="Nouvelle version (les versions existantes ne sont jamais modifiées)">
        <form action={createPolicyAction} className="space-y-4 text-sm" data-testid="policy-form">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col">Date d'effet *<input type="date" name="validFrom" className="input" required defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            <label className="flex flex-col">Remise revendeur (%) *<input name="discount" className="input" required inputMode="decimal" defaultValue={val(base?.discountBps)} /></label>
            <label className="flex flex-col">Objectif de marge brute (% du prix HT)<input name="marginTarget" className="input" inputMode="decimal" defaultValue={val(base?.marginTargetBps)} placeholder="non défini" /></label>
            <label className="flex flex-col">Objectif de contribution (% du prix HT, prioritaire)<input name="contributionTarget" className="input" inputMode="decimal" defaultValue={val(base?.contributionTargetBps)} placeholder="non défini" /></label>
            <label className="flex flex-col">Relevé ancien au-delà de (jours)<input name="staleDays" className="input" inputMode="numeric" defaultValue={base?.staleDays ?? 120} /></label>
            <label className="flex flex-col">Tolérance de dimensions par côté (%)<input name="dimTolerance" className="input" inputMode="decimal" defaultValue={val(base?.dimToleranceBps ?? 1000)} /></label>
            <label className="flex flex-col">Arrondi du prix conseillé (pas en €)<input name="roundingStep" className="input" inputMode="decimal" defaultValue={((base?.rounding.stepMinor ?? 1000) / 100).toString()} /></label>
            <label className="flex flex-col">Base de l'arrondi<select name="roundingBasis" className="input" defaultValue={base?.rounding.basis ?? "TTC"}><option value="TTC">prix TTC affiché</option><option value="HT">prix HT</option></select></label>
          </div>
          <p className="text-xs text-stone-700">La remise est un paramètre de coût interne (prix d'achat net = prix catalogue éligible × (1 − remise)), jamais une remise client : prix publics et politique de vente inchangés. Objectif non défini : aucun plancher ni prix conseillé (aucune politique commerciale supposée).</p>

          <fieldset><legend className="font-medium">Assiette de la remise</legend>
            <p className="text-xs text-stone-700">Structure (cellule de la grille catalogue) : éligible par défaut. Suppléments en pourcentage : calculés sur la structure après remise (ordre du catalogue), sans seconde remise. Montants fixes et tableaux (moteurs, LED, poteaux, centrale…) : remise appliquée seulement si le poste est déclaré éligible ; « inconnu » = coût non établi, signalé.</p>
            <Table caption="Éligibilité des postes">
              <thead><tr><th>Poste</th><th>Produits</th><th>Éligibilité</th></tr></thead>
              <tbody data-testid="eligibility">
                <tr><td>Structure (cellule de la grille)</td><td>tous</td><td><select name="elig:structure" className="input min-h-0 py-1" defaultValue={elig.structure ?? "ELIGIBLE"}><option value="ELIGIBLE">éligible</option><option value="NOT_ELIGIBLE">non éligible</option><option value="UNKNOWN">inconnue</option></select></td></tr>
                {posts.map((p) => <tr key={p.code}><td>{p.label}<div className="text-xs text-stone-700">{p.code}</div></td><td className="text-xs">{[...p.families].join(", ")}</td><td><select name={`elig:supplement:${p.code}`} className="input min-h-0 py-1" defaultValue={elig[`supplement:${p.code}`] ?? "UNKNOWN"}><option value="UNKNOWN">inconnue</option><option value="ELIGIBLE">éligible</option><option value="NOT_ELIGIBLE">non éligible</option></select></td></tr>)}
              </tbody>
            </Table>
          </fieldset>

          <fieldset><legend className="font-medium">Coûts directs par défaut</legend>
            <div className="grid gap-2 md:grid-cols-3">
              {DIRECT_COST_KEYS.map((key) => {
                const c = costs.find((x) => x.key === key)!;
                const v = c.mode === "percent" ? val(c.percentBps) : c.amountMinor != null ? (c.amountMinor / 100).toFixed(2).replace(".", ",") : "";
                return (
                  <fieldset key={key} className="rounded border border-sand-200 p-2 text-xs"><legend>{DIRECT_COST_FR[key]}</legend>
                    <select name={`cost_${key}_status`} className="input min-h-0 py-1" defaultValue={c.status}><option value="known">renseigné</option><option value="unknown">inconnu</option><option value="na">sans objet</option></select>
                    <select name={`cost_${key}_mode`} className="input min-h-0 py-1" defaultValue={c.mode}><option value="fixed">montant HT par vente (€)</option><option value="percent">pourcentage</option></select>
                    <input name={`cost_${key}_value`} className="input min-h-0 py-1" placeholder="valeur" defaultValue={v} />
                    <select name={`cost_${key}_base`} className="input min-h-0 py-1" defaultValue={c.base ?? "sale_ht"}>{Object.entries(COST_BASE_FR).map(([b, l]) => <option key={b} value={b}>assiette : {l}</option>)}</select>
                    <label className="flex items-center gap-1"><input type="checkbox" name={`cost_${key}_billed`} value="1" defaultChecked={!!c.billedToClient} /> facturé au client à part</label>
                    <input name={`cost_${key}_note`} className="input min-h-0 py-1" placeholder="note" defaultValue={c.note ?? ""} />
                  </fieldset>
                );
              })}
            </div>
          </fieldset>
          <label className="flex flex-col">Note (source de la décision)<input name="note" className="input" defaultValue="" /></label>
          <button className="btn-primary" type="submit">Enregistrer une nouvelle version</button>
        </form>
        {base && <p className="mt-2 text-xs text-stone-700">Valeurs préremplies depuis la version {base.version}. Exemple de contrôle : catalogue {eur(400_000)} HT, remise {pctFr(base.discountBps)} → achat net {eur(400_000 - Math.floor((400_000 * base.discountBps + 5000) / 10_000))} HT.</p>}
      </Section>
    </div>
  );
}
