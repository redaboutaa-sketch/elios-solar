import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { CompatStatus, DataStatus } from "@/generated/prisma/enums";
import type { ClosureCompatRule, OptionCompatRule } from "@/generated/prisma/client";
import { COMPAT_FR, DATA_STATUS_FR, Flash, Options, PageTitle, Section } from "@/components/admin/ui";
import { deleteClosureRuleAction, deleteOptionRuleAction, saveClosureRuleAction, saveOptionRuleAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Règles de compatibilité" };
const cell = "input py-1 min-h-0 text-sm";
const MOUNTING_FR: Record<string, string> = { "*": "Toutes", freestanding: "Autoportée", wall: "Adossée" };

type Fam = { slug: string; name: string };
function FamilyOptions({ list, star }: { list: Fam[]; star?: boolean }) {
  return <>{star && <option value="*">* (toutes)</option>}{list.map((f) => <option key={f.slug} value={f.slug}>{f.name} ({f.slug})</option>)}</>;
}
/** Garantit qu'une valeur existante absente de la liste reste sélectionnable. */
function withValue(list: Fam[], value: string): Fam[] {
  return value === "*" || list.some((f) => f.slug === value) ? list : [{ slug: value, name: "inconnue" }, ...list];
}

function ClosureRow({ r, closures, pergolas, finishes }: { r: ClosureCompatRule | null; closures: Fam[]; pergolas: Fam[]; finishes: string[] }) {
  const fid = r ? `cr-${r.id}` : "cr-new";
  return (
    <tr className="border-t border-sand-200 align-top">
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-c`}>Fermeture</label><select form={fid} id={`${fid}-c`} name="closureFamilySlug" className={cell} defaultValue={r?.closureFamilySlug}><FamilyOptions list={withValue(closures, r?.closureFamilySlug ?? "*")} /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-p`}>Pergola</label><select form={fid} id={`${fid}-p`} name="pergolaFamilySlug" className={cell} defaultValue={r?.pergolaFamilySlug ?? "*"}><FamilyOptions list={withValue(pergolas, r?.pergolaFamilySlug ?? "*")} star /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-l`}>Longueur de segment (mm)</label><input form={fid} id={`${fid}-l`} name="segmentLengthMm" type="number" min={100} placeholder="toutes" className={`${cell} w-24`} defaultValue={r?.segmentLengthMm ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-f`}>Finition pergola</label><select form={fid} id={`${fid}-f`} name="pergolaFinishCode" className={cell} defaultValue={r?.pergolaFinishCode ?? "*"}><option value="*">* (toutes)</option>{[...new Set([...(r && r.pergolaFinishCode !== "*" ? [r.pergolaFinishCode] : []), ...finishes])].map((c) => <option key={c} value={c}>{c}</option>)}</select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-m`}>Implantation</label><select form={fid} id={`${fid}-m`} name="mounting" className={cell} defaultValue={r?.mounting ?? "*"}><Options values={["*", "freestanding", "wall"]} labels={MOUNTING_FR} /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-s`}>Statut</label><select form={fid} id={`${fid}-s`} name="status" className={cell} defaultValue={r?.status ?? "ALLOWED"}><Options values={Object.values(CompatStatus)} labels={COMPAT_FR} /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-r`}>Motif</label><input form={fid} id={`${fid}-r`} name="reason" maxLength={500} className={`${cell} w-56`} defaultValue={r?.reason ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-d`}>Fiabilité</label><select form={fid} id={`${fid}-d`} name="dataStatus" className={cell} defaultValue={r?.dataStatus ?? "UNKNOWN"}><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></td>
      <td className="p-1 whitespace-nowrap">
        <form id={fid} action={saveClosureRuleAction} className="inline">{r && <input type="hidden" name="id" value={r.id} />}<button className="btn-secondary py-1 min-h-0" type="submit">{r ? "Enregistrer" : "Ajouter"}</button></form>
        {r && <form action={deleteClosureRuleAction} className="inline ml-1"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>}
      </td>
    </tr>
  );
}

function OptionRow({ r, options, pergolas }: { r: OptionCompatRule | null; options: Fam[]; pergolas: Fam[] }) {
  const fid = r ? `or-${r.id}` : "or-new";
  return (
    <tr className="border-t border-sand-200 align-top">
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-o`}>Option</label><select form={fid} id={`${fid}-o`} name="optionFamilySlug" className={cell} defaultValue={r?.optionFamilySlug}><FamilyOptions list={withValue(options, r?.optionFamilySlug ?? "*")} /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-p`}>Pergola</label><select form={fid} id={`${fid}-p`} name="pergolaFamilySlug" className={cell} defaultValue={r?.pergolaFamilySlug ?? "*"}><FamilyOptions list={withValue(pergolas, r?.pergolaFamilySlug ?? "*")} star /></select></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-s`}>Statut</label><select form={fid} id={`${fid}-s`} name="status" className={cell} defaultValue={r?.status ?? "ALLOWED"}><Options values={Object.values(CompatStatus)} labels={COMPAT_FR} /></select></td>
      <td className="p-1 text-center"><label className="sr-only" htmlFor={`${fid}-i`}>Inclus dans la base</label><input form={fid} id={`${fid}-i`} name="includedInBase" type="checkbox" className="h-5 w-5" defaultChecked={r?.includedInBase ?? false} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-q`}>Quantité max</label><input form={fid} id={`${fid}-q`} name="maxQty" type="number" min={1} className={`${cell} w-20`} defaultValue={r?.maxQty ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-r`}>Motif</label><input form={fid} id={`${fid}-r`} name="reason" maxLength={500} className={`${cell} w-56`} defaultValue={r?.reason ?? ""} /></td>
      <td className="p-1"><label className="sr-only" htmlFor={`${fid}-d`}>Fiabilité</label><select form={fid} id={`${fid}-d`} name="dataStatus" className={cell} defaultValue={r?.dataStatus ?? "UNKNOWN"}><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></td>
      <td className="p-1 whitespace-nowrap">
        <form id={fid} action={saveOptionRuleAction} className="inline">{r && <input type="hidden" name="id" value={r.id} />}<button className="btn-secondary py-1 min-h-0" type="submit">{r ? "Enregistrer" : "Ajouter"}</button></form>
        {r && <form action={deleteOptionRuleAction} className="inline ml-1"><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>}
      </td>
    </tr>
  );
}

export default async function RulesPage(props: PageProps<"/admin/catalogue/regles">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [families, finishes, closureRules, optionRules] = await Promise.all([
    prisma.productFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true, kind: true } }),
    prisma.finish.findMany({ orderBy: { sortOrder: "asc" }, select: { code: true } }),
    prisma.closureCompatRule.findMany({ orderBy: [{ closureFamilySlug: "asc" }, { pergolaFamilySlug: "asc" }, { segmentLengthMm: "asc" }] }),
    prisma.optionCompatRule.findMany({ orderBy: [{ optionFamilySlug: "asc" }, { pergolaFamilySlug: "asc" }] }),
  ]);
  const closures = families.filter((f) => f.kind === "SIDE_CLOSURE");
  const pergolas = families.filter((f) => f.kind === "PERGOLA_STANDARD" || f.kind === "PERGOLA_CUSTOM");
  const options = families.filter((f) => f.kind === "OPTION" || f.kind === "SERVICE");
  const finishCodes = finishes.map((f) => f.code);
  const head = "bg-sand-100 text-left text-stone-700 [&_th]:p-2 [&_th]:font-medium";
  return (
    <div className="space-y-6">
      <PageTitle title="Règles de compatibilité" />
      <Flash searchParams={props.searchParams} />
      <p className="text-sm text-stone-700">La règle la plus spécifique s'applique. « * » signifie « toutes ». Un statut « Inconnu » oriente le client vers un devis.</p>
      <Section title={`Fermetures latérales (${closureRules.length})`}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[1200px] text-sm">
            <caption className="sr-only">Règles de compatibilité des fermetures</caption>
            <thead className={head}><tr><th>Fermeture</th><th>Pergola</th><th>Segment (mm)</th><th>Finition</th><th>Implantation</th><th>Statut</th><th>Motif</th><th>Fiabilité</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {closureRules.map((r) => <ClosureRow key={r.id} r={r} closures={closures} pergolas={pergolas} finishes={finishCodes} />)}
              <tr><td colSpan={9} className="pt-4 text-xs font-medium uppercase tracking-wide text-stone-700">Nouvelle règle</td></tr>
              <ClosureRow r={null} closures={closures} pergolas={pergolas} finishes={finishCodes} />
            </tbody>
          </table>
        </div>
      </Section>
      <Section title={`Options (${optionRules.length})`}>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <caption className="sr-only">Règles de compatibilité des options</caption>
            <thead className={head}><tr><th>Option</th><th>Pergola</th><th>Statut</th><th>Inclus</th><th>Qté max</th><th>Motif</th><th>Fiabilité</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {optionRules.map((r) => <OptionRow key={r.id} r={r} options={options} pergolas={pergolas} />)}
              <tr><td colSpan={8} className="pt-4 text-xs font-medium uppercase tracking-wide text-stone-700">Nouvelle règle</td></tr>
              <OptionRow r={null} options={options} pergolas={pergolas} />
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
