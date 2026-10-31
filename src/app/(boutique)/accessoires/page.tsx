import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CATEGORIES, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import type { OptionDef, SystemRules } from "@/domain/system";
import { prisma } from "@/lib/prisma";
import { publicSystemRules } from "@/domain/public-sanitize";

export const metadata: Metadata = {
  title: "Options et accessoires",
  description: "Télécommandes, box domotique, capteurs de vent, éclairage LED et fermetures latérales coulissantes : compatibilités confirmées par modèle, et équipements à étudier au devis.",
  alternates: { canonical: "/accessoires" },
};

type Fam = { slug: string; name: string; category: CategoryKey; rules: SystemRules };

/** Rubriques d'équipements : rattachement d'une option par son code, son groupe ou son rendu. */
const KINDS: Array<{ id: string; title: string; intro: string; match: (o: OptionDef) => boolean; closure?: readonly string[] }> = [
  { id: "telecommandes", title: "Télécommandes", intro: "Émetteurs radio pour piloter un produit motorisé. Le modèle dépend du moteur : il est défini au devis.", match: (o) => o.visual === "remote" || /remote/.test(o.code) },
  { id: "domotique", title: "Box domotique et commande par smartphone", intro: "Une box pilote depuis une application les moteurs radio compatibles ; elle ne rend pas connecté un moteur qui ne l'est pas.", match: (o) => o.visual === "box" || /box/.test(o.code) },
  { id: "capteurs", title: "Capteurs de vent, de soleil et de pluie", intro: "Ils commandent automatiquement le produit motorisé selon des seuils réglés. Ils ne dispensent jamais de replier le produit au-delà de la vitesse de vent admissible.", match: (o) => o.visual === "wind_sensor" || /sensor|weather|wind/.test(o.code) },
  { id: "eclairage", title: "Éclairage LED", intro: "Éclairage intégré à la structure (lames, profil, coffre ou bras) selon le modèle.", match: (o) => o.group === "lighting" },
  { id: "fermetures", title: "Fermetures latérales coulissantes", intro: "Parois vitrées coulissantes et autres fermetures des côtés d'une pergola : un accessoire, étudié selon les ouvertures réelles, les fixations et la résistance au vent.", match: () => false, closure: ["sliding_glass", "sliding_panels"] },
];

const statusText = (o: { wish?: boolean; status: string }) => (o.wish ? "à étudier au devis (compatibilité non confirmée)" : o.status === "to_confirm" ? "option documentée, à confirmer au devis" : "option documentée");

export default async function AccessoriesPage() {
  const rows = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, systemRules: { not: undefined } }, select: { slug: true, name: true, category: true, systemRules: true }, orderBy: { sortOrder: "asc" } });
  const fams: Fam[] = rows.filter((r) => r.systemRules).map((r) => ({ slug: r.slug, name: r.name, category: r.category as CategoryKey, rules: publicSystemRules(r.systemRules as unknown as SystemRules) }));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Options et accessoires" }]} />
      <h1 className="mt-4 font-display text-display font-semibold">Options et accessoires</h1>
      <p className="mt-2 max-w-3xl text-stone-700 text-pretty">Un équipement n'est proposé comme option d'un modèle que lorsque la documentation du fabricant le confirme. Sinon, vous pouvez le signaler comme souhait dans le configurateur : le conseiller vérifie la compatibilité au devis. Les prix des options sont établis au devis.</p>
      <nav aria-label="Rubriques" className="mt-6 flex flex-wrap gap-2 text-sm">{KINDS.map((k) => <a key={k.id} href={`#${k.id}`} className="btn-secondary px-3 py-1.5">{k.title}</a>)}<a href="#vent" className="btn-secondary px-3 py-1.5">Comportement au vent</a></nav>
      {KINDS.map((k) => {
        const list = fams.flatMap((f) => {
          const opts = f.rules.options.filter(k.match).map((o) => ({ label: o.label, status: statusText(o), prereq: o.prerequisite }));
          const incl = k.id === "telecommandes" ? f.rules.included.filter((i) => /télécommande|émetteur/i.test(i.label)).map((i) => ({ label: i.label, status: i.status === "to_confirm" ? "inclus, à confirmer" : "inclus", prereq: undefined })) : [];
          const closures = k.closure ? (f.rules.closureWishes ?? []).filter((w) => k.closure!.includes(w.familySlug)).map((w) => ({ label: w.label, status: w.note, prereq: undefined })) : [];
          const all = [...incl, ...opts, ...closures];
          return all.length ? [{ f, all }] : [];
        });
        return (
          <section key={k.id} id={k.id} className="section-y scroll-mt-24 border-t border-sand-200" aria-labelledby={`${k.id}-t`} data-testid={`acc-${k.id}`}>
            <h2 id={`${k.id}-t`} className="font-display text-2xl font-semibold">{k.title}</h2>
            <p className="mt-2 max-w-3xl text-stone-700">{k.intro}</p>
            {list.length === 0 ? <p className="mt-4 text-sm text-stone-700">Aucun modèle du catalogue ne documente cet équipement à ce jour.</p> : (
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-sand-300 text-stone-700"><tr><th className="py-2 pr-4 font-medium">Modèle</th><th className="py-2 pr-4 font-medium">Équipement</th><th className="py-2 font-medium">Statut</th></tr></thead>
                <tbody>{list.flatMap(({ f, all }) => all.map((o, i) => (
                  <tr key={`${f.slug}-${i}`} className="border-b border-sand-200 align-top">
                    <td className="py-2 pr-4">{i === 0 ? <Link href={productHref(f.category, f.slug)} className="link-brand">{f.name}</Link> : null}</td>
                    <td className="py-2 pr-4">{o.label}{o.prereq ? <span className="block text-xs text-stone-700">Prérequis : {o.prereq}</span> : null}</td>
                    <td className="py-2 text-stone-800">{o.status}</td>
                  </tr>
                )))}</tbody>
              </table></div>
            )}
          </section>
        );
      })}
      <section id="vent" className="section-y scroll-mt-24 border-t border-sand-200" aria-labelledby="vent-t" data-testid="acc-vent">
        <h2 id="vent-t" className="font-display text-2xl font-semibold">Comportement au vent, modèle par modèle</h2>
        <p className="mt-2 max-w-3xl text-stone-700">Chaque produit réagit différemment : tout ne se ferme pas automatiquement. Voici ce que documente le fabricant.</p>
        {CATEGORIES.map((c) => {
          const items = fams.filter((f) => f.category === c.key && f.rules.wind);
          return items.length ? (
            <div key={c.key} className="mt-6"><h3 className="font-semibold">{c.label}</h3>
              <ul className="mt-2 space-y-2 text-sm">{items.map((f) => <li key={f.slug}><Link href={configuratorHref(f.slug)} className="link-brand">{f.name}</Link>{f.rules.wind!.status === "to_confirm" ? " (à confirmer)" : ""} : {f.rules.wind!.text}</li>)}</ul>
            </div>
          ) : null;
        })}
      </section>
      <p className="mt-8 text-sm text-stone-700">Un doute sur un équipement ? <Link href="/contact" className="underline">Demandez conseil</Link> — ou consultez l'<Link href="/guides/choisir-toile-et-motorisation" className="underline">aide au choix des toiles et motorisations</Link>.</p>
    </div>
  );
}
