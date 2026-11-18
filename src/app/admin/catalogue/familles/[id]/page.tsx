import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { DataStatus } from "@/generated/prisma/enums";
import { DATA_STATUS_FR, DataStatusBadge, FAMILY_STATUS_FR, Flash, Options, PageTitle, Section, Table } from "@/components/admin/ui";
import { SPEC_SOURCE_FR, formatSpecValue, reviewSpec, type SpecSource } from "@/domain/technical-spec";
import { specTargetId } from "@/server/validation/targets";
import { LEGACY_FAMILY_SLUGS } from "@/server/catalog/legacy-slugs";
import { NAME_TRANSCO } from "@/server/catalog/name-transco";
import type { SystemRules } from "@/domain/system";
import { addFamilyDocumentAction, addFamilyMediaAction, removeFamilyDocumentAction, removeFamilyMediaAction, updateFamilyAction } from "@/server/actions/admin/catalog";

export const metadata: Metadata = { title: "Édition de famille" };

const SPEC_STATUSES = ["demo", "supplier_verified", "observed", "unknown"] as const;
const SPEC_STATUS_FR: Record<string, string> = { demo: "Démo", supplier_verified: "Vérifié fournisseur", observed: "Observé", unknown: "Inconnu" };

export default async function FamilyEditPage(props: PageProps<"/admin/catalogue/familles/[id]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const [family, medias] = await Promise.all([
    prisma.productFamily.findUnique({ where: { id }, include: { media: { include: { media: true }, orderBy: { sortOrder: "asc" } }, documents: { include: { media: true }, orderBy: { createdAt: "asc" } }, technicalSpecs: { orderBy: [{ key: "asc" }, { createdAt: "asc" }] } } }),
    prisma.media.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, path: true, alt: true, kind: true, mimeType: true } }),
  ]);
  if (!family) notFound();
  const specs = [...((family.specs as Array<{ label: string; value: string; status: string }>) ?? []), ...Array.from({ length: 3 }, () => ({ label: "", value: "", status: "unknown" }))];
  const faq = [...((family.faq as Array<{ q: string; a: string }>) ?? []), ...Array.from({ length: 2 }, () => ({ q: "", a: "" }))];
  const included = ((family.included as string[]) ?? []).join("\n");
  const images = medias.filter((m) => m.kind === "image");
  const legacySlugs = [...new Set([...family.legacySlugs, ...Object.entries(LEGACY_FAMILY_SLUGS).filter(([, to]) => to === family.slug).map(([from]) => from)])];
  const transco = NAME_TRANSCO.find((t) => t.kind === "product" && t.slug === family.slug);
  const rules = family.systemRules as unknown as SystemRules | null;
  const supplierItems = rules ? [...(rules.controls ?? []), ...rules.included, ...rules.options].filter((x): x is typeof x & { supplierRef: string } => !!x.supplierRef && x.supplierRef !== x.label) : [];
  const pdfs = medias.filter((m) => m.kind === "document" || m.mimeType === "application/pdf");
  return (
    <div className="space-y-6">
      <PageTitle title={family.name} backHref="/admin/catalogue/familles" backLabel="Familles">
        <div className="flex gap-2 text-sm"><span className="font-mono">{family.slug}</span><span>· {family.kind} · {FAMILY_STATUS_FR[family.status]}</span><DataStatusBadge status={family.dataStatus} /></div>
      </PageTitle>
      <Flash searchParams={props.searchParams} />

      {(family.supplierRef || family.manufacturer || family.brand) && (
        <Section title="Correspondance fournisseur (interne)">
          <p className="mb-3 text-xs text-stone-700">Données internes, jamais publiées : le site n'affiche que le nom commercial (nomenclature HELIOSTORES).</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="supplier-mapping">
            <dt className="text-stone-700">Identifiant interne (stable)</dt><dd className="font-mono">{family.id}</dd>
            <dt className="text-stone-700">Nom commercial</dt><dd>{family.name} <span className="text-xs text-stone-700">(modifiable ci-dessous{transco ? " ; nom validé par le client le 2026-10-31" : " ; provisoire tant que le client ne l'a pas approuvé"})</span></dd>
            <dt className="text-stone-700">Slug public</dt><dd className="font-mono">{family.slug} <span className="font-sans text-xs text-stone-700">(changement par migration, avec redirection)</span></dd>
            <dt className="text-stone-700">Référence fournisseur</dt><dd>{family.supplierRef ?? "—"}</dd>
            {transco && <><dt className="text-stone-700">Transcodification (validation client)</dt><dd data-testid="name-transco">{transco.previous.join(" / ")} → {transco.name} · réf. {transco.supplierRef} · statut technique : {transco.technical === "etabli" ? "établi" : <strong className="text-amber-800">à confirmer</strong>}{"note" in transco && transco.note ? ` — ${transco.note}` : ""}</dd></>}
            <dt className="text-stone-700">Fabricant</dt><dd>{family.manufacturer ?? "—"}</dd>
            <dt className="text-stone-700">Marque</dt><dd>{family.brand ?? "—"}</dd>
            {legacySlugs.length > 0 && <><dt className="text-stone-700">Ancien identifiant</dt><dd className="font-mono">{legacySlugs.join(", ")} (redirigé)</dd></>}
            <dt className="text-stone-700">Noms précédents</dt><dd data-testid="name-history">{(Array.isArray(family.nameHistory) ? (family.nameHistory as Array<{ name: string; until?: string; by?: string }>) : []).map((h) => `${h.name} (jusqu'au ${h.until ?? "?"}${h.by ? `, ${h.by}` : ""})`).join(" · ") || "—"}</dd>
            <dt className="text-stone-700">Textes commerciaux</dt><dd>{family.commercialEditedAt ? `modifiés dans l'administration le ${family.commercialEditedAt.toLocaleString("fr-FR")} : conservés aux déploiements` : "valeurs du référentiel (mises à jour aux déploiements)"}</dd>
          </dl>
          <p className="mt-2 text-xs text-stone-700">La référence fournisseur sert à la fabrication, aux achats, au SAV et à la traçabilité ; les documents officiels (notices, déclarations des performances) gardent leurs désignations d'origine.</p>
          {supplierItems.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead><tr className="text-left text-xs text-stone-700"><th className="py-1 pr-3 font-medium">Libellé public</th><th className="py-1 pr-3 font-medium">Désignation fournisseur</th></tr></thead>
              <tbody>{supplierItems.map((x) => <tr key={x.label} className="border-t border-sand-200"><td className="py-1 pr-3">{x.label}</td><td className="py-1 pr-3">{x.supplierRef}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      )}

      <form action={updateFamilyAction} className="space-y-6">
        <input type="hidden" name="id" value={family.id} />
        <Section title="Textes et référencement">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label className="label" htmlFor="name">Nom</label><input id="name" name="name" required maxLength={120} className="input" defaultValue={family.name} /></div>
            <div><label className="label" htmlFor="shortDescription">Description courte</label><input id="shortDescription" name="shortDescription" maxLength={500} className="input" defaultValue={family.shortDescription} /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="description">Description (markdown)</label><textarea id="description" name="description" rows={8} className="input font-mono text-sm" defaultValue={family.description} /></div>
            <div><label className="label" htmlFor="seoTitle">Titre SEO</label><input id="seoTitle" name="seoTitle" maxLength={160} className="input" defaultValue={family.seoTitle ?? ""} /></div>
            <div><label className="label" htmlFor="seoDescription">Description SEO</label><input id="seoDescription" name="seoDescription" maxLength={320} className="input" defaultValue={family.seoDescription ?? ""} /></div>
          </div>
        </Section>

        <Section title="Caractéristiques techniques">
          <p className="mb-2 text-xs text-stone-700">Une ligne par caractéristique. Laisser libellé et valeur vides pour supprimer une ligne.</p>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-stone-700"><th className="p-1 font-medium">Libellé</th><th className="p-1 font-medium">Valeur</th><th className="p-1 font-medium">Statut</th></tr></thead>
              <tbody>
                {specs.map((s, i) => (
                  <tr key={i}>
                    <td className="p-1"><label className="sr-only" htmlFor={`sl-${i}`}>Libellé {i + 1}</label><input id={`sl-${i}`} name="spec_label" className="input py-1.5 min-h-0" defaultValue={s.label} /></td>
                    <td className="p-1"><label className="sr-only" htmlFor={`sv-${i}`}>Valeur {i + 1}</label><input id={`sv-${i}`} name="spec_value" className="input py-1.5 min-h-0" defaultValue={s.value} /></td>
                    <td className="p-1"><label className="sr-only" htmlFor={`ss-${i}`}>Statut {i + 1}</label><select id={`ss-${i}`} name="spec_status" className="input py-1.5 min-h-0" defaultValue={s.status}><Options values={SPEC_STATUSES} labels={SPEC_STATUS_FR} /></select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Inclus">
            <label className="label" htmlFor="included">Éléments inclus (un par ligne)</label>
            <textarea id="included" name="included" rows={7} className="input text-sm" defaultValue={included} />
          </Section>
          <Section title="Paramètres techniques">
            <div className="grid gap-4">
              <div><label className="label" htmlFor="accessoryRails">Rails d'accessoires</label><input id="accessoryRails" name="accessoryRails" type="number" min={0} max={20} className="input" defaultValue={family.accessoryRails ?? ""} /></div>
              <div><label className="label" htmlFor="lightingIncluded">Éclairage inclus</label><select id="lightingIncluded" name="lightingIncluded" className="input" defaultValue={family.lightingIncluded ?? ""}><option value="">Non applicable</option><option value="none">Aucun</option><option value="gutter_led">LED de gouttière</option><option value="blade_led">LED dans les lames</option></select></div>
              <div><label className="label" htmlFor="dividerThresholdMm">Seuil de poteau intermédiaire (mm)</label><input id="dividerThresholdMm" name="dividerThresholdMm" type="number" min={500} max={20000} className="input" defaultValue={family.dividerThresholdMm ?? ""} /><p className="mt-1 text-xs text-stone-700">Longueur de côté à partir de laquelle un poteau divise le côté en deux segments.</p></div>
            </div>
          </Section>
        </div>

        <Section title="Questions fréquentes">
          <div className="space-y-3">
            {faq.map((x, i) => (
              <div key={i} className="grid gap-2 md:grid-cols-[1fr_2fr]">
                <div><label className="label" htmlFor={`fq-${i}`}>Question {i + 1}</label><input id={`fq-${i}`} name="faq_q" className="input" defaultValue={x.q} /></div>
                <div><label className="label" htmlFor={`fa-${i}`}>Réponse {i + 1}</label><textarea id={`fa-${i}`} name="faq_a" rows={2} className="input" defaultValue={x.a} /></div>
              </div>
            ))}
          </div>
        </Section>
        <div className="sticky bottom-0 -mx-4 border-t border-sand-200 bg-sand-50/95 px-4 py-3 lg:-mx-8 lg:px-8"><button className="btn-primary" type="submit">Enregistrer la famille</button></div>
      </form>

      {family.technicalSpecs.length > 0 && (
        <Section title="Données techniques sourcées">
          <Table caption="Données techniques par provenance">
            <thead><tr><th>Donnée</th><th>Valeur</th><th>Provenance</th><th>Référence de la source</th><th>Affichage public</th></tr></thead>
            <tbody>
              {family.technicalSpecs.map((t) => {
                const values = family.technicalSpecs.filter((x) => x.key === t.key).map((x) => ({ ...x, observedAt: x.observedAt?.toISOString().slice(0, 10) ?? null, source: x.source.toLowerCase() as SpecSource }));
                const r = reviewSpec(values, t.key);
                const src = t.source.toLowerCase() as SpecSource;
                return (
                  <tr key={t.id}>
                    <td>{t.label}{r?.conflict ? <span className="ml-1 badge-warn">valeurs divergentes</span> : null}</td>
                    <td>{formatSpecValue(t)}</td>
                    <td><span className={src === "supplier_confirmed" ? "badge-ok" : src === "demo_seed" ? "badge-demo" : "badge bg-sand-100 text-stone-800 border border-sand-300"}>{SPEC_SOURCE_FR[src]}</span></td>
                    <td className="text-xs">{t.sourceRef || "—"}</td>
                    <td>{r?.confirmed ? formatSpecValue(r.confirmed) : <><span>à confirmer</span> · <Link className="underline" href={`/admin/catalogue/validations/nouveau?type=FAMILY_SPEC&cible=${encodeURIComponent(specTargetId(family.slug, t.key))}`}>ouvrir un dossier</Link></>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <p className="mt-2 text-xs text-stone-700">Seule une spécification fournisseur confirmée (via un dossier de validation sourcé) est présentée publiquement comme certaine.</p>
        </Section>
      )}

      <Section title="Médias de la fiche">
        <Table caption="Médias associés">
          <thead><tr><th>Aperçu</th><th>Rôle</th><th>Légende</th><th className="text-right">Ordre</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {family.media.map((pm) => (
              <tr key={pm.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <td><img src={pm.media.path} alt={pm.media.alt} className="h-14 w-20 rounded object-cover bg-sand-100" /></td>
                <td>{pm.role}</td><td>{pm.caption || "—"}</td><td className="text-right">{pm.sortOrder}</td>
                <td><form action={removeFamilyMediaAction}><input type="hidden" name="id" value={pm.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Retirer</button></form></td>
              </tr>
            ))}
            {family.media.length === 0 && <tr><td colSpan={5} className="text-stone-700">Aucun média.</td></tr>}
          </tbody>
        </Table>
        {images.length === 0 ? <p className="mt-3 text-sm text-stone-700">Aucune image dans la médiathèque : <Link className="underline" href="/admin/medias">téléverser</Link>.</p> : (
          <form action={addFamilyMediaAction} className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr_2fr_6rem_auto] md:items-end">
            <input type="hidden" name="familyId" value={family.id} />
            <div><label className="label" htmlFor="pm-media">Image</label><select id="pm-media" name="mediaId" required className="input">{images.map((m) => <option key={m.id} value={m.id}>{m.alt || m.path}</option>)}</select></div>
            <div><label className="label" htmlFor="pm-role">Rôle</label><select id="pm-role" name="role" className="input" defaultValue="gallery"><option value="hero">Principale</option><option value="gallery">Galerie</option><option value="detail">Détail</option><option value="thumbnail">Vignette</option></select></div>
            <div><label className="label" htmlFor="pm-caption">Légende</label><input id="pm-caption" name="caption" className="input" maxLength={300} /></div>
            <div><label className="label" htmlFor="pm-sort">Ordre</label><input id="pm-sort" name="sortOrder" type="number" min={0} defaultValue={family.media.length} className="input" /></div>
            <button className="btn-secondary" type="submit">Associer</button>
          </form>
        )}
      </Section>

      <Section title="Documents (notices, fiches techniques)">
        <Table caption="Documents">
          <thead><tr><th>Titre</th><th>Type</th><th>Fichier</th><th>Fiabilité</th><th><span className="sr-only">Action</span></th></tr></thead>
          <tbody>
            {family.documents.map((d) => (
              <tr key={d.id}>
                <td>{d.title}</td><td>{d.kind}</td><td>{d.media ? <a className="underline" href={d.media.path}>Ouvrir</a> : "—"}</td><td><DataStatusBadge status={d.dataStatus} /></td>
                <td><form action={removeFamilyDocumentAction}><input type="hidden" name="id" value={d.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form></td>
              </tr>
            ))}
            {family.documents.length === 0 && <tr><td colSpan={5} className="text-stone-700">Aucun document.</td></tr>}
          </tbody>
        </Table>
        {pdfs.length === 0 ? <p className="mt-3 text-sm text-stone-700">Aucun PDF dans la médiathèque : <Link className="underline" href="/admin/medias">téléverser</Link>.</p> : (
          <form action={addFamilyDocumentAction} className="mt-4 grid gap-3 md:grid-cols-[2fr_2fr_1fr_1fr_auto] md:items-end">
            <input type="hidden" name="familyId" value={family.id} />
            <div><label className="label" htmlFor="doc-title">Titre</label><input id="doc-title" name="title" required maxLength={200} className="input" /></div>
            <div><label className="label" htmlFor="doc-media">Fichier</label><select id="doc-media" name="mediaId" required className="input">{pdfs.map((m) => <option key={m.id} value={m.id}>{m.alt || m.path}</option>)}</select></div>
            <div><label className="label" htmlFor="doc-kind">Type</label><select id="doc-kind" name="kind" className="input"><option value="notice">Notice</option><option value="fiche-technique">Fiche technique</option><option value="garantie">Garantie</option><option value="plan">Plan</option><option value="autre">Autre</option></select></div>
            <div><label className="label" htmlFor="doc-ds">Fiabilité</label><select id="doc-ds" name="dataStatus" className="input" defaultValue="UNKNOWN"><Options values={Object.values(DataStatus)} labels={DATA_STATUS_FR} /></select></div>
            <button className="btn-secondary" type="submit">Ajouter</button>
          </form>
        )}
      </Section>
    </div>
  );
}
