import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DataStatus, FamilyStatus } from "@/generated/prisma/enums";
import { DATA_STATUS_FR, DataStatusBadge, FAMILY_STATUS_FR, Flash, Options, PageTitle, Table } from "@/components/admin/ui";
import { updateFamilyStatusAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Familles" };

export default async function FamiliesPage(props: PageProps<"/admin/catalogue/familles">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const families = await prisma.productFamily.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { variants: true, media: true, documents: true } } } });
  return (
    <div>
      <PageTitle title="Familles de produits" />
      <Flash searchParams={props.searchParams} />
      <Table caption="Familles de produits">
        <thead><tr><th>Famille</th><th>Type</th><th className="text-right">Variantes</th><th className="text-right">Médias</th><th>Données</th><th>Statut / fiabilité</th></tr></thead>
        <tbody>
          {families.map((f) => (
            <tr key={f.id}>
              <td><Link href={`/admin/catalogue/familles/${f.id}`} className="underline">{f.name}</Link><span className="block font-mono text-xs text-stone-700">{f.slug}</span></td>
              <td className="text-xs">{f.kind}</td>
              <td className="text-right"><Link className="underline" href={`/admin/catalogue/variantes?famille=${f.slug}`}>{f._count.variants}</Link></td>
              <td className="text-right">{f._count.media} / {f._count.documents} doc.</td>
              <td><DataStatusBadge status={f.dataStatus} /></td>
              <td>
                <form action={updateFamilyStatusAction} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={f.id} />
                  <label className="sr-only" htmlFor={`st-${f.id}`}>Statut de {f.name}</label>
                  <select id={`st-${f.id}`} name="status" defaultValue={f.status} className="input w-36 py-1 min-h-0 text-sm"><Options values={Object.values(FamilyStatus)} labels={FAMILY_STATUS_FR} /></select>
                  <label className="sr-only" htmlFor={`ds-${f.id}`}>Fiabilité des données de {f.name}</label>
                  <select id={`ds-${f.id}`} name="dataStatus" defaultValue={f.dataStatus} className="input w-40 py-1 min-h-0 text-sm"><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select>
                  <button className="btn-secondary py-1 min-h-0" type="submit">Enregistrer</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
