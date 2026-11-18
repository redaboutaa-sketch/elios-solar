import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { createPromotionAction, togglePromotionAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Promotions" };

export default async function PromotionsPage(props: PageProps<"/admin/catalogue/promotions">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [promos, families] = await Promise.all([
    prisma.promotion.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.productFamily.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  const now = new Date();
  return (
    <div className="space-y-6">
      <PageTitle title="Promotions" />
      <Flash searchParams={props.searchParams} />
      <Section title="Promotions existantes">
        <Table caption="Promotions">
          <thead><tr><th>Libellé</th><th>Code</th><th>Remise</th><th>Périmètre</th><th>Période</th><th>État</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {promos.map((p) => {
              const inWindow = (!p.startsAt || p.startsAt <= now) && (!p.endsAt || p.endsAt > now);
              return (
                <tr key={p.id}>
                  <td>{p.label}</td><td className="font-mono">{p.code ?? <span className="text-stone-700">automatique</span>}</td>
                  <td>{(p.percentBps / 100).toLocaleString("fr-FR")} %</td>
                  <td className="text-xs">{p.allFamilies ? "Toutes les familles" : p.familySlugs.join(", ")}</td>
                  <td className="text-xs">{fmtDate(p.startsAt, false)} → {fmtDate(p.endsAt, false)}</td>
                  <td>{p.active ? (inWindow ? <StatusBadge tone="ok">Active</StatusBadge> : <StatusBadge tone="warn">Active hors période</StatusBadge>) : <StatusBadge tone="neutral">Inactive</StatusBadge>}</td>
                  <td><form action={togglePromotionAction}><input type="hidden" name="id" value={p.id} /><button className="btn-secondary py-1 min-h-0" type="submit">{p.active ? "Désactiver" : "Activer"}</button></form></td>
                </tr>
              );
            })}
            {promos.length === 0 && <tr><td colSpan={7} className="text-stone-700">Aucune promotion.</td></tr>}
          </tbody>
        </Table>
      </Section>
      <Section title="Nouvelle promotion">
        <form action={createPromotionAction} className="grid gap-4 md:grid-cols-2">
          <div><label className="label" htmlFor="label">Libellé</label><input id="label" name="label" required maxLength={120} className="input" /></div>
          <div><label className="label" htmlFor="code">Code (facultatif — vide = remise automatique)</label><input id="code" name="code" maxLength={30} className="input uppercase" /></div>
          <div><label className="label" htmlFor="percent">Remise (%)</label><input id="percent" name="percent" inputMode="decimal" required placeholder="10" className="input" /></div>
          <fieldset className="md:row-span-2">
            <legend className="label">Familles concernées</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allFamilies" className="h-4 w-4" /> Toutes les familles</label>
            <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded border border-sand-200 p-2 text-sm">
              {families.map((f) => <label key={f.slug} className="flex items-center gap-2"><input type="checkbox" name="familySlugs" value={f.slug} className="h-4 w-4" /> {f.name}</label>)}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="startsAt">Début</label><input id="startsAt" name="startsAt" type="date" className="input" /></div>
            <div><label className="label" htmlFor="endsAt">Fin</label><input id="endsAt" name="endsAt" type="date" className="input" /></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" className="h-4 w-4" /> Activer immédiatement</label>
          <div className="md:col-span-2"><button className="btn-primary" type="submit">Créer la promotion</button></div>
        </form>
      </Section>
    </div>
  );
}
