import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { prisma } from "@/lib/prisma";
import { publicSystemRules } from "@/domain/public-sanitize";
import { CATEGORIES, configuratorHref, type CategoryKey } from "@/domain/categories";
import type { SystemRules } from "@/domain/system";

export const metadata: Metadata = { title: "Choisir sa toile et sa motorisation", description: "Toiles et motorisations proposées par modèle : usages, différences, équipements nécessaires et inclus.", alternates: { canonical: "/guides/choisir-toile-et-motorisation" } };

/** Aide au choix : uniquement les toiles et commandes documentées de chaque modèle (références techniques en interne). */
export default async function FabricGuide() {
  const rows = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, category: true, systemRules: true }, orderBy: { sortOrder: "asc" } });
  const fams = rows.filter((r) => r.systemRules).map((r) => ({ slug: r.slug, name: r.name, category: r.category as CategoryKey, rules: publicSystemRules(r.systemRules as unknown as SystemRules) }));
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ href: "/guides", label: "Guides et installation" }, { label: "Toiles et motorisations" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Choisir sa toile et sa motorisation</h1>
      <div className="mt-4 grid max-w-3xl gap-3 text-stone-800 text-pretty">
        <p><strong>Toile microperforée</strong> (screens) : elle filtre le soleil et la chaleur tout en gardant une vue vers l'extérieur ; plus son facteur d'ouverture est faible, plus elle occulte.</p>
        <p><strong>Toile acrylique ou technique</strong> (stores bannes, toitures) : choisie sur nuancier pour sa teinte et son usage ; une toile imperméable convient aux toitures exposées à la pluie.</p>
        <p><strong>Manivelle ou moteur</strong> : la manivelle est simple et sans raccordement ; le moteur demande une alimentation électrique et permet télécommande, capteurs et pilotage par smartphone lorsque le moteur est compatible.</p>
      </div>
      {CATEGORIES.map((c) => {
        const items = fams.filter((f) => f.category === c.key && (f.rules.fabrics?.length || f.rules.controls?.length));
        if (!items.length) return null;
        return (
          <section key={c.key} className="section-y border-t border-sand-200" aria-labelledby={`t-${c.key}`}>
            <h2 id={`t-${c.key}`} className="font-display text-2xl font-semibold">{c.label}</h2>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm" data-testid={`fabric-compare-${c.key}`}>
              <thead className="border-b border-sand-300 text-stone-700"><tr><th className="py-2 pr-4 font-medium">Modèle</th><th className="py-2 pr-4 font-medium">Toiles documentées</th><th className="py-2 pr-4 font-medium">Manœuvre</th><th className="py-2 font-medium">Compris</th></tr></thead>
              <tbody>{items.map((f) => (
                <tr key={f.slug} className="border-b border-sand-200 align-top">
                  <th scope="row" className="py-3 pr-4 font-semibold"><Link href={configuratorHref(f.slug)} className="link-brand">{f.name}</Link></th>
                  <td className="py-3 pr-4">{f.rules.fabrics?.length ? <ul className="space-y-1">{f.rules.fabrics.map((x) => <li key={x.code}>{x.label}{x.status === "to_confirm" ? " (à confirmer)" : ""}{x.description ? <span className="block text-xs text-stone-700">{x.description}</span> : null}</li>)}</ul> : "—"}</td>
                  <td className="py-3 pr-4">{f.rules.controls?.length ? (f.rules.controls.some((x) => x.kind === "manual") ? (f.rules.controls.some((x) => x.kind === "electric") ? "manivelle ou moteur" : "manivelle") : "moteur uniquement") : "—"}</td>
                  <td className="py-3">{f.rules.included.filter((i) => /moteur|motoris|télécommande|commande|toile/i.test(i.label)).map((i) => i.label).join(" ; ") || "—"}</td>
                </tr>
              ))}</tbody>
            </table></div>
          </section>
        );
      })}
      <p className="mt-6 text-sm text-stone-700">Besoin d'un avis ? <Link href="/contact" className="underline">Demandez conseil</Link> : un conseiller vous aide à choisir. Voir aussi <Link href="/accessoires" className="underline">options et accessoires</Link>.</p>
    </div>
  );
}
