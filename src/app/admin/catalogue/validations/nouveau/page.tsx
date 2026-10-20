import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, Options, PageTitle, Section, DATA_STATUS_FR } from "@/components/admin/ui";
import { ProposalFields, SourceFields } from "@/components/admin/validation-fields";
import { createValidationAction } from "@/server/actions/admin/validations";
import { TARGET_FR, type TargetType } from "@/server/validation/core";
import { listTargets, loadTarget } from "@/server/validation/targets";
import { SPEC_SOURCE_FR } from "@/domain/technical-spec";

export const metadata: Metadata = { title: "Nouveau dossier de validation" };

const STATUS_FR: Record<string, string> = { ...DATA_STATUS_FR, ...Object.fromEntries(Object.entries(SPEC_SOURCE_FR).map(([k, v]) => [k.toUpperCase(), v])) };

export default async function NewValidationPage(props: PageProps<"/admin/catalogue/validations/nouveau">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const type: TargetType = typeof sp.type === "string" && sp.type in TARGET_FR ? (sp.type as TargetType) : "VARIANT";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const cible = typeof sp.cible === "string" ? sp.cible.slice(0, 200) : "";
  const [targets, target, documents] = await Promise.all([
    listTargets(prisma, type, q),
    cible ? loadTarget(prisma, type, cible) : Promise.resolve(null),
    prisma.document.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ title: "asc" }, { version: "desc" }], select: { id: true, title: true, version: true, status: true }, take: 200 }),
  ]);
  return (
    <div className="space-y-6">
      <PageTitle title="Nouveau dossier de validation" backHref="/admin/catalogue/validations" backLabel="Dossiers" />
      <Flash searchParams={props.searchParams} />
      <Section title="1. Cible">
        <form className="flex flex-wrap items-end gap-2">
          <div><label className="label" htmlFor="type">Type</label><select id="type" name="type" defaultValue={type} className="input"><Options values={Object.keys(TARGET_FR)} labels={TARGET_FR} /></select></div>
          <div><label className="label" htmlFor="q">Recherche</label><input id="q" name="q" defaultValue={q} className="input" /></div>
          <div className="min-w-0 flex-1"><label className="label" htmlFor="cible">Cible ({targets.length} non vérifiée(s))</label><select id="cible" name="cible" defaultValue={cible} className="input w-full"><option value="">(choisir)</option>{targets.map((t) => <option key={t.id} value={t.id}>{t.label} — {STATUS_FR[t.status] ?? t.status}</option>)}</select></div>
          <button className="btn-secondary" type="submit">Afficher</button>
        </form>
      </Section>
      {cible && !target && <Section><p className="text-sm text-danger">Cible introuvable.</p></Section>}
      {target && (
        <form action={createValidationAction} className="space-y-6">
          <input type="hidden" name="targetType" value={type} /><input type="hidden" name="targetId" value={target.id} />
          <Section title={`2. Données proposées — ${target.label}`}><ProposalFields type={type} current={target.data} /></Section>
          <Section title="3. Source"><SourceFields documents={documents} /></Section>
          <button className="btn-primary" type="submit">Créer le dossier (brouillon)</button>
        </form>
      )}
    </div>
  );
}
