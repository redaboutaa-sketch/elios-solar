import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { DataStatus, StockMode } from "@/generated/prisma/enums";
import { DATA_STATUS_FR, Flash, Options, PageTitle, Pagination } from "@/components/admin/ui";
import { centsToEuros } from "@/server/admin/form";
import { updateVariantAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Variantes" };
const PER_PAGE = 100;
const STOCK_FR: Record<string, string> = { STOCK: "Stock", MADE_TO_ORDER: "Sur commande" };

export default async function VariantsPage(props: PageProps<"/admin/catalogue/variantes">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const famille = typeof sp.famille === "string" ? sp.famille.slice(0, 80) : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.VariantWhereInput = { ...(famille ? { family: { slug: famille } } : {}), ...(q ? { sku: { contains: q, mode: "insensitive" } } : {}) };
  const [families, total, variants] = await Promise.all([
    prisma.productFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.variant.count({ where }),
    prisma.variant.findMany({ where, orderBy: [{ family: { sortOrder: "asc" } }, { sku: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { family: { select: { slug: true } } } }),
  ]);
  const params = { ...(famille ? { famille } : {}), ...(q ? { q } : {}) };
  const returnTo = `/admin/catalogue/variantes?${new URLSearchParams({ ...params, page: String(page) })}`;
  const cell = "input py-1 min-h-0 text-sm";
  return (
    <div>
      <PageTitle title="Variantes (SKU)" />
      <Flash searchParams={props.searchParams} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="famille">Famille</label><select id="famille" name="famille" className="input" defaultValue={famille}><option value="">Toutes</option>{families.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></div>
        <div><label className="label" htmlFor="q">SKU contient</label><input id="q" name="q" className="input" defaultValue={q} /></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <p className="mb-2 text-sm text-stone-700">{total} variante(s). Les prix sont saisis TTC en euros. Une modification de prix n'affecte jamais les commandes déjà passées (lignes figées).</p>
      <div className="relative overflow-x-auto rounded-lg border border-sand-200 bg-white">
        <table className="w-full min-w-[1200px] text-sm">
          <caption className="sr-only">Variantes éditables</caption>
          <thead className="bg-sand-100 text-left text-stone-700"><tr>
            <th className="p-2 font-medium">SKU / libellé</th><th className="p-2 font-medium">Prix TTC (€)</th><th className="p-2 font-medium">Prix barré (€)</th><th className="p-2 font-medium">Achetable</th><th className="p-2 font-medium">Stock</th><th className="p-2 font-medium">Qté</th><th className="p-2 font-medium">Réservé</th><th className="p-2 font-medium">Délai (j)</th><th className="p-2 font-medium">Fiabilité</th><th className="p-2 font-medium">Active</th><th className="p-2"><span className="sr-only">Enregistrer</span></th>
          </tr></thead>
          <tbody>
            {variants.map((v) => {
              const fid = `v-${v.id}`;
              return (
                <tr key={v.id} className="border-t border-sand-200 align-top">
                  <td className="p-2"><span className="font-mono text-xs">{v.sku}</span><span className="block text-xs text-stone-700">{v.label}</span><span className="block text-xs text-stone-700">{v.family.slug}</span></td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-price`}>Prix TTC de {v.sku}</label><input form={fid} id={`${fid}-price`} name="price" inputMode="decimal" required className={`${cell} w-28`} defaultValue={centsToEuros(v.priceCents)} /></td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-cmp`}>Prix barré de {v.sku}</label><input form={fid} id={`${fid}-cmp`} name="compareAt" inputMode="decimal" className={`${cell} w-28`} defaultValue={centsToEuros(v.compareAtCents)} /></td>
                  <td className="p-2 text-center"><label className="sr-only" htmlFor={`${fid}-pur`}>{v.sku} achetable</label><input form={fid} id={`${fid}-pur`} name="purchasable" type="checkbox" className="h-5 w-5" defaultChecked={v.purchasable} /></td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-sm`}>Mode de stock de {v.sku}</label><select form={fid} id={`${fid}-sm`} name="stockMode" className={`${cell} w-36`} defaultValue={v.stockMode}><Options values={Object.values(StockMode)} labels={STOCK_FR} /></select></td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-qty`}>Quantité en stock de {v.sku}</label><input form={fid} id={`${fid}-qty`} name="stockQty" type="number" min={0} className={`${cell} w-20`} defaultValue={v.stockQty ?? ""} /></td>
                  <td className="p-2 tabular-nums">{v.reservedQty}</td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-lead`}>Délai de {v.sku}</label><input form={fid} id={`${fid}-lead`} name="leadTimeDays" type="number" min={0} className={`${cell} w-20`} defaultValue={v.leadTimeDays ?? ""} /></td>
                  <td className="p-2"><label className="sr-only" htmlFor={`${fid}-ds`}>Fiabilité de {v.sku}</label><select form={fid} id={`${fid}-ds`} name="dataStatus" className={`${cell} w-40`} defaultValue={v.dataStatus}><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></td>
                  <td className="p-2 text-center"><label className="sr-only" htmlFor={`${fid}-act`}>{v.sku} active</label><input form={fid} id={`${fid}-act`} name="active" type="checkbox" className="h-5 w-5" defaultChecked={v.active} /></td>
                  <td className="p-2">
                    <form id={fid} action={updateVariantAction}><input type="hidden" name="id" value={v.id} /><input type="hidden" name="returnTo" value={returnTo} /><button className="btn-secondary py-1 min-h-0" type="submit">Enregistrer</button></form>
                  </td>
                </tr>
              );
            })}
            {variants.length === 0 && <tr><td colSpan={11} className="p-3 text-stone-700">Aucune variante.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/catalogue/variantes?${new URLSearchParams({ ...params, page: String(p) })}`} />
    </div>
  );
}
