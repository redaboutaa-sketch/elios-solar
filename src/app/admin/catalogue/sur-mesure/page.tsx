import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DataStatus } from "@/generated/prisma/enums";
import { DATA_STATUS_FR, Flash, Options, PageTitle, Section } from "@/components/admin/ui";
import { saveCustomSettingsAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Pergola sur mesure" };

const AXES = [
  { key: "width", label: "Largeur" },
  { key: "length", label: "Longueur" },
  { key: "height", label: "Hauteur" },
] as const;

export default async function CustomSettingsPage(props: PageProps<"/admin/catalogue/sur-mesure">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const s = (await prisma.customPergolaSettings.findUnique({ where: { id: 1 } })) ?? { quoteOnly: true, widthMinMm: 2000, widthMaxMm: 4000, widthStepMm: 10, lengthMinMm: 2000, lengthMaxMm: 6000, lengthStepMm: 10, heightMinMm: 2200, heightMaxMm: 3000, heightStepMm: 10, dataStatus: "UNKNOWN" as const };
  return (
    <div>
      <PageTitle title="Pergola sur mesure" />
      <Flash searchParams={props.searchParams} />
      <Section>
        <form action={saveCustomSettingsAction} className="space-y-5">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="quoteOnly" defaultChecked={s.quoteOnly} className="h-4 w-4" /> Sur devis uniquement (pas d'achat direct)</label>
          {AXES.map((a) => (
            <fieldset key={a.key} className="grid gap-3 sm:grid-cols-3">
              <legend className="mb-1 text-sm font-medium">{a.label} (mm)</legend>
              <div><label className="label" htmlFor={`${a.key}MinMm`}>Minimum</label><input id={`${a.key}MinMm`} name={`${a.key}MinMm`} type="number" required className="input" defaultValue={s[`${a.key}MinMm`]} /></div>
              <div><label className="label" htmlFor={`${a.key}MaxMm`}>Maximum</label><input id={`${a.key}MaxMm`} name={`${a.key}MaxMm`} type="number" required className="input" defaultValue={s[`${a.key}MaxMm`]} /></div>
              <div><label className="label" htmlFor={`${a.key}StepMm`}>Pas</label><input id={`${a.key}StepMm`} name={`${a.key}StepMm`} type="number" min={1} required className="input" defaultValue={s[`${a.key}StepMm`]} /></div>
            </fieldset>
          ))}
          <div className="max-w-xs"><label className="label" htmlFor="dataStatus">Fiabilité des bornes</label><select id="dataStatus" name="dataStatus" className="input" defaultValue={s.dataStatus}><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></div>
          <button className="btn-primary" type="submit">Enregistrer</button>
        </form>
      </Section>
    </div>
  );
}
