import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, Options, PageTitle, Section, Table, fmtDate } from "@/components/admin/ui";
import { ValidationStatusBadge } from "@/components/admin/validation-fields";
import { TARGET_FR, VALIDATION_STATUS_FR, shortHash, type TargetType, type ValidationStatus } from "@/server/validation/core";
import { listValidations } from "@/server/validation/service";

export const metadata: Metadata = { title: "Validation des références" };

export default async function ValidationsPage(props: PageProps<"/admin/catalogue/validations">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const status = typeof sp.statut === "string" && sp.statut in VALIDATION_STATUS_FR ? (sp.statut as ValidationStatus) : undefined;
  const targetType = typeof sp.type === "string" && sp.type in TARGET_FR ? (sp.type as TargetType) : undefined;
  const rows = await listValidations({ status, targetType });
  return (
    <div className="space-y-6">
      <PageTitle title="Validation des références"><Link href="/admin/catalogue/validations/nouveau" className="btn-primary">Nouveau dossier</Link></PageTitle>
      <Flash searchParams={props.searchParams} />
      <Section>
        <p className="text-sm text-stone-700">Chaque dossier compare les données actuelles d'une référence, d'une règle de compatibilité ou d'une donnée technique avec des données proposées et leur source. Une validation porte sur une <strong>version précise</strong> des données (empreinte) et ne rend jamais une référence achetable : la mise en vente exige aussi prix, disponibilité et compatibilités validés.</p>
      </Section>
      <Section title={`Dossiers (${rows.length})`}>
        <form className="mb-4 flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="statut">Statut</label><select id="statut" name="statut" defaultValue={status ?? ""} className="input"><Options includeEmpty="Tous" values={Object.keys(VALIDATION_STATUS_FR)} labels={VALIDATION_STATUS_FR} /></select></div>
          <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={targetType ?? ""} className="input"><Options includeEmpty="Tous" values={Object.keys(TARGET_FR)} labels={TARGET_FR} /></select></div>
          <button className="btn-secondary" type="submit">Filtrer</button>
        </form>
        {rows.length === 0 ? <p className="text-sm text-stone-700">Aucun dossier.</p> : (
          <Table caption="Dossiers de validation">
            <thead><tr><th>Cible</th><th>Type</th><th>Statut</th><th>Version des données</th><th>Auteur</th><th>Mis à jour</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link className="underline" href={`/admin/catalogue/validations/${r.id}`}>{r.targetLabel}</Link></td>
                  <td>{TARGET_FR[r.targetType]}</td>
                  <td><ValidationStatusBadge status={r.status} /></td>
                  <td className="font-mono text-xs">{shortHash(r.baseHash)}</td>
                  <td>{r.createdBy?.email ?? "jeu de démonstration"}</td>
                  <td>{fmtDate(r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Section>
    </div>
  );
}
