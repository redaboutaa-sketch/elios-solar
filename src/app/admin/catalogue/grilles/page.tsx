import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DATA_STATUS_FR, Flash, PageTitle, Section, fmtDate } from "@/components/admin/ui";
import { GridImportForm, GridTestForm } from "@/components/admin/grid-forms";
import { setGridStatusAction } from "@/server/actions/admin/grids";
import { gridFromDb } from "@/server/catalog/load";
import { validateGrid } from "@/domain/pricing-grid";

export const metadata: Metadata = { title: "Grilles sur mesure" };
const STATUS_FR: Record<string, string> = { DRAFT: "Brouillon", TESTING: "En test", PUBLISHED: "Publiée", ARCHIVED: "Archivée" };
const eur = (c: number) => (c / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default async function GridsPage(props: PageProps<"/admin/catalogue/grilles">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const grids = await prisma.priceGrid.findMany({ orderBy: [{ familySlug: "asc" }, { version: "desc" }], include: { _count: { select: { cells: true, surcharges: true } } } });
  const selectedId = typeof sp.grille === "string" ? sp.grille : grids[0]?.id;
  const sel = selectedId ? await prisma.priceGrid.findUnique({ where: { id: selectedId }, include: { cells: { orderBy: [{ widthMinMm: "asc" }, { lengthMinMm: "asc" }] }, surcharges: { orderBy: { sortOrder: "asc" } } } }) : null;
  const v = sel ? validateGrid(gridFromDb(sel)) : null;
  return (
    <div className="space-y-6">
      <PageTitle title="Grilles tarifaires sur mesure" />
      <Flash searchParams={props.searchParams} />
      <Section>
        <p className="text-sm text-stone-700">Le prix sur mesure est calculé uniquement à partir d'une grille <strong>publiée</strong>, en vigueur, selon ses cellules (largeur × longueur, implantation, finition) et ses suppléments : aucun prix au m² n'est supposé. Une grille fictive ou non « vérifiée fournisseur » produit une <strong>estimation</strong> qui ne devient jamais un prix ferme : le client est orienté vers un devis. Hors grille, combinaison sans tarif ou validation technique : devis avec conservation complète du projet.</p>
      </Section>
      <Section title="Importer une grille (nouvelle version en brouillon)">
        <p className="mb-3 text-xs text-stone-700">Format JSON (voir <code>docs/import/grille-sur-mesure.example.json</code>) ou CSV : lignes <code>#clé=valeur</code> (familySlug, name, source, priceUnit=cents|euros, widthMin/Max/Step, lengthMin/Max/Step, heightMin/Max/Step, mountings=wall|freestanding, finishCodes=A|B, validFrom, validTo, dataStatus) puis colonnes widthMinMm, widthMaxMm, lengthMinMm, lengthMaxMm, mounting, finishCode, price.</p>
        <GridImportForm />
      </Section>
      <Section title="Versions">
        <table className="w-full text-sm"><thead><tr className="text-left"><th>Famille</th><th>Version</th><th>Nom</th><th>Statut</th><th>Fiabilité</th><th>Validité</th><th>Cellules</th><th /></tr></thead><tbody>
          {grids.map((g) => (
            <tr key={g.id} className={`border-t border-sand-200 ${g.id === selectedId ? "bg-sand-100" : ""}`}>
              <td>{g.familySlug}</td><td>v{g.version}</td><td>{g.name}{g.isDemo && <span className="badge-warn ml-1">fictive</span>}</td><td>{STATUS_FR[g.status]}</td><td>{DATA_STATUS_FR[g.dataStatus]}</td>
              <td>{g.validFrom ? fmtDate(g.validFrom, false) : "—"} → {g.validTo ? fmtDate(g.validTo, false) : "—"}</td><td>{g._count.cells}</td>
              <td><a className="underline" href={`/admin/catalogue/grilles?grille=${g.id}`}>Ouvrir</a></td>
            </tr>
          ))}
        </tbody></table>
      </Section>
      {sel && v && (
        <Section title={`${sel.name} — v${sel.version} (${STATUS_FR[sel.status]})`}>
          <p className="text-sm text-stone-700">Source : {sel.source || "—"} · import : {sel.importFilename ?? "seed"} · bornes {sel.widthMinMm}–{sel.widthMaxMm} × {sel.lengthMinMm}–{sel.lengthMaxMm} × h {sel.heightMinMm}–{sel.heightMaxMm} mm (pas {sel.widthStepMm}/{sel.lengthStepMm}/{sel.heightStepMm}) · implantations {sel.mountings.join(", ") || "toutes"} · finitions {sel.finishCodes.join(", ") || "toutes"}</p>
          <div className="mt-2 text-sm">{v.errors.map((e, i) => <p key={i} className="text-danger">✗ {e.message}</p>)}{v.warnings.map((w, i) => <p key={i} className="text-warning">⚠ {w.message}</p>)}<p>Couverture : {(v.coverage * 100).toFixed(0)} %</p></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["TESTING", "PUBLISHED", "ARCHIVED", "DRAFT"] as const).filter((s) => s !== sel.status).map((s) => (
              <form key={s} action={setGridStatusAction}><input type="hidden" name="id" value={sel.id} /><input type="hidden" name="status" value={s} /><button className={s === "PUBLISHED" ? "btn-primary" : "btn-secondary"} type="submit">{s === "TESTING" ? "Passer en test" : s === "PUBLISHED" ? "Publier" : s === "ARCHIVED" ? "Archiver" : "Repasser en brouillon"}</button></form>
            ))}
          </div>
          <h3 className="mt-5 font-medium">Tester une combinaison (avant publication)</h3>
          <GridTestForm gridId={sel.id} finishCodes={sel.finishCodes} />
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium">Cellules ({sel.cells.length}) et suppléments ({sel.surcharges.length})</summary>
            <table className="mt-2 w-full text-xs"><tbody>{sel.cells.map((c) => <tr key={c.id} className="border-t border-sand-200"><td>{c.widthMinMm}–{c.widthMaxMm}</td><td>× {c.lengthMinMm}–{c.lengthMaxMm}</td><td>{c.mounting}</td><td>{c.finishCode}</td><td className="text-right">{eur(c.priceCents)}</td></tr>)}</tbody></table>
            <ul className="mt-2 text-xs list-disc pl-5">{sel.surcharges.map((s) => <li key={s.id}>{s.label} ({s.kind}, {s.match}) : {s.perStepCents != null ? `${eur(s.perStepCents)} par ${s.perStepMm} mm au-delà de ${s.thresholdMm} mm` : s.percentBps ? `${s.percentBps / 100} %` : eur(s.priceCents)}</li>)}</ul>
          </details>
        </Section>
      )}
    </div>
  );
}
