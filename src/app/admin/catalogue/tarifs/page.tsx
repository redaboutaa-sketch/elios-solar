import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DataStatus } from "@/generated/prisma/enums";
import type { InstallationRate, ShippingRule } from "@/generated/prisma/client";
import { DATA_STATUS_FR, Flash, Options, PageTitle, Section } from "@/components/admin/ui";
import { centsToEuros } from "@/server/admin/form";
import { deleteInstallationRateAction, deleteShippingRuleAction, saveInstallationRateAction, saveShippingRuleAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Montage & livraison" };
const cell = "input py-1 min-h-0 text-sm";
const head = "bg-sand-100 text-left text-stone-700 [&_th]:p-2 [&_th]:font-medium";

function RateRow({ r, families, dimensions }: { r: InstallationRate | null; families: Array<{ slug: string; name: string }>; dimensions: string[] }) {
  const fid = r ? `ir-${r.id}` : "ir-new";
  const fams = r && !families.some((f) => f.slug === r.familySlug) ? [{ slug: r.familySlug, name: "inconnue" }, ...families] : families;
  const dims = r?.dimensionCode && !dimensions.includes(r.dimensionCode) ? [r.dimensionCode, ...dimensions] : dimensions;
  return (
    <tr className="border-t border-sand-200">
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-f`}>Famille</label><select form={fid} id={`${fid}-f`} name="familySlug" className={cell} defaultValue={r?.familySlug}>{fams.map((f) => <option key={f.slug} value={f.slug}>{f.name} ({f.slug})</option>)}</select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-d`}>Dimension</label><select form={fid} id={`${fid}-d`} name="dimensionCode" className={cell} defaultValue={r?.dimensionCode ?? ""}><option value="">Toutes / sans objet</option>{dims.map((d) => <option key={d} value={d}>{d}</option>)}</select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-p`}>Prix TTC (€)</label><input form={fid} id={`${fid}-p`} name="price" inputMode="decimal" required className={`${cell} w-28`} defaultValue={centsToEuros(r?.priceCents)} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-s`}>Fiabilité</label><select form={fid} id={`${fid}-s`} name="dataStatus" className={cell} defaultValue={r?.dataStatus ?? "UNKNOWN"}><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></td>
      <td className="p-1 whitespace-nowrap">
        <form id={fid} action={saveInstallationRateAction} className="inline">{r && <input type="hidden" name="id" value={r.id} />}<button className="btn-secondary py-1 min-h-0" type="submit">{r ? "Enregistrer" : "Ajouter"}</button></form>
        {r && <form action={deleteInstallationRateAction} className="inline ml-1"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>}
      </td>
    </tr>
  );
}

function ShipRow({ r }: { r: ShippingRule | null }) {
  const fid = r ? `sr-${r.id}` : "sr-new";
  return (
    <tr className="border-t border-sand-200">
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-c`}>Pays</label><input form={fid} id={`${fid}-c`} name="countryCode" maxLength={2} required className={`${cell} w-16 uppercase`} defaultValue={r?.countryCode ?? "FR"} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-pp`}>Préfixes de code postal (séparés par des virgules)</label><input form={fid} id={`${fid}-pp`} name="postalPrefixes" placeholder="vide = reste du pays" className={`${cell} w-56`} defaultValue={r?.postalPrefixes.join(", ") ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-l`}>Libellé</label><input form={fid} id={`${fid}-l`} name="label" required maxLength={120} className={`${cell} w-56`} defaultValue={r?.label ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-p`}>Prix TTC (€)</label><input form={fid} id={`${fid}-p`} name="price" inputMode="decimal" required className={`${cell} w-24`} defaultValue={centsToEuros(r?.priceCents ?? 0)} /></td>
      <td className="p-1 text-center"><label className="sr-only" htmlFor={`${fid}-q`}>Sur devis</label><input form={fid} id={`${fid}-q`} name="quoteRequired" type="checkbox" className="h-5 w-5" defaultChecked={r?.quoteRequired ?? false} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-o`}>Ordre</label><input form={fid} id={`${fid}-o`} name="sortOrder" type="number" min={0} className={`${cell} w-16`} defaultValue={r?.sortOrder ?? 0} /></td>
      <td className="p-1 whitespace-nowrap">
        <form id={fid} action={saveShippingRuleAction} className="inline">{r && <input type="hidden" name="id" value={r.id} />}<button className="btn-secondary py-1 min-h-0" type="submit">{r ? "Enregistrer" : "Ajouter"}</button></form>
        {r && <form action={deleteShippingRuleAction} className="inline ml-1"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>}
      </td>
    </tr>
  );
}

export default async function RatesPage(props: PageProps<"/admin/catalogue/tarifs">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [families, dimensions, rates, shipping] = await Promise.all([
    prisma.productFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.dimensionPreset.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true } }),
    prisma.installationRate.findMany({ orderBy: [{ familySlug: "asc" }, { dimensionCode: "asc" }] }),
    prisma.shippingRule.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const dims = dimensions.map((d) => d.code);
  return (
    <div className="space-y-6">
      <PageTitle title="Montage & livraison" />
      <Flash searchParams={props.searchParams} />
      <Section title={`Tarifs de montage (${rates.length})`}>
        <div className="relative overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <caption className="sr-only">Tarifs de montage</caption>
          <thead className={head}><tr><th>Famille</th><th>Dimension</th><th>Prix TTC (€)</th><th>Fiabilité</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rates.map((r) => <RateRow key={r.id} r={r} families={families} dimensions={dims} />)}
            <tr><td colSpan={5} className="pt-4 text-xs font-medium uppercase tracking-wide text-stone-700">Nouveau tarif</td></tr>
            <RateRow r={null} families={families} dimensions={dims} />
          </tbody>
        </table></div>
      </Section>
      <Section title={`Règles de livraison (${shipping.length})`}>
        <p className="mb-2 text-xs text-stone-700">Les règles avec préfixes (ex. « 20 » pour la Corse) sont prioritaires ; une règle sans préfixe couvre le reste du pays.</p>
        <div className="relative overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Règles de livraison</caption>
          <thead className={head}><tr><th>Pays</th><th>Préfixes CP</th><th>Libellé</th><th>Prix TTC (€)</th><th>Sur devis</th><th>Ordre</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {shipping.map((r) => <ShipRow key={r.id} r={r} />)}
            <tr><td colSpan={7} className="pt-4 text-xs font-medium uppercase tracking-wide text-stone-700">Nouvelle règle</td></tr>
            <ShipRow r={null} />
          </tbody>
        </table></div>
      </Section>
    </div>
  );
}
