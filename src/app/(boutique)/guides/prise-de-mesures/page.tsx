import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbJsonLd } from "@/server/seo/structured-data";
import { BRAND } from "@/config/brand";

import { MeasureTool, type MeasureModel } from "@/components/guides/measure-tool";
import { prisma } from "@/lib/prisma";
import { publicSystemRules } from "@/domain/public-sanitize";
import type { SystemRules } from "@/domain/system";
import { CATEGORIES, productHref, type CategoryKey } from "@/domain/categories";
import { MEASURE_COMMON, measureAdvice } from "@/domain/measure-advice";

export const metadata: Metadata = { title: "Prise de mesures", description: "Comment mesurer pour une pergola, un screen, un store banne ou une moustiquaire, selon le type de pose, et reporter vos mesures dans le configurateur.", alternates: { canonical: "/guides/prise-de-mesures" } };

export default async function MeasurePage() {
  const rows = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, category: true, systemRules: true }, orderBy: { sortOrder: "asc" } });
  const models: MeasureModel[] = rows.filter((r) => r.systemRules).map((r) => ({ slug: r.slug, name: r.name, category: r.category as CategoryKey, rules: publicSystemRules(r.systemRules as unknown as SystemRules) }));
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ href: "/guides", label: "Guides et installation" }, { label: "Prise de mesures" }]} />
      <JsonLd data={breadcrumbJsonLd(BRAND.siteUrl, [{ name: "Guides et installation", path: "/guides" }, { name: "Prise de mesures", path: "/guides/prise-de-mesures" }])} />
      <h1 className="mt-5 font-display text-display font-semibold">Prise de mesures</h1>
      <p className="mt-3 max-w-3xl text-stone-800 text-pretty">Choisissez votre famille, votre modèle et votre type de pose : le schéma indique ce qu'il faut mesurer. Vos mesures sont comparées aux dimensions documentées du modèle, puis reportées dans le configurateur. Elles restent indicatives : un conseiller les vérifie avec vous lors de l'étude du devis.</p>
      <div className="mt-8"><MeasureTool models={models} /></div>
      <MeasureAdviceByFamily models={models} />
      <p className="mt-10 text-sm text-stone-700">Voir aussi : <Link href="/guides/preparation-projet" className="underline">préparer son projet</Link>.</p>
    </div>
  );
}

/**
 * Conseils de relevé de chaque famille et de chaque pose documentée, rendus côté serveur : l'outil interactif n'affiche
 * qu'une combinaison à la fois, ce texte reste lisible sans JavaScript (moteurs de recherche, assistants, impression).
 */
function MeasureAdviceByFamily({ models }: { models: MeasureModel[] }) {
  const families = CATEGORIES.map((c) => {
    const inCat = models.filter((m) => m.category === c.key);
    const groups = new Map<string, { title: string; tips: string[]; models: MeasureModel[] }>();
    for (const m of inCat) for (const mt of m.rules.mountings) {
      const roof = c.key === "SCREENS" && m.rules.type === "roof_blind";
      const tips = measureAdvice(c.key, mt.code, m.rules.type).filter((t) => t !== MEASURE_COMMON);
      const key = `${roof ? "roof" : "std"}|${tips.join("|")}`;
      const g = groups.get(key) ?? { title: roof ? `Screen de toiture, pose ${mt.label.toLowerCase()}` : `Pose ${mt.label.toLowerCase()}`, tips, models: [] };
      if (!g.models.includes(m)) g.models.push(m);
      groups.set(key, g);
    }
    return { c, groups: [...groups.values()] };
  }).filter((f) => f.groups.length);
  if (!families.length) return null;
  return (
    <section className="mt-12 border-t border-sand-200 pt-8" aria-labelledby="mesures-par-famille" data-testid="measure-advice-all">
      <h2 id="mesures-par-famille" className="font-display text-2xl font-semibold">Ce qu&apos;il faut mesurer, famille par famille</h2>
      <p className="mt-3 max-w-3xl text-stone-800">{MEASURE_COMMON}</p>
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {families.map(({ c, groups }) => (
          <div key={c.key}>
            <h3 className="text-lg font-semibold"><Link href={c.href} className="link-brand">{c.label}</Link></h3>
            {groups.map((g) => (
              <div key={g.title + g.models.map((m) => m.slug).join()} className="mt-3">
                <p className="font-medium text-stone-900">{g.title} ({g.models.map((m, i) => <span key={m.slug}>{i ? ", " : ""}<Link href={productHref(c.key, m.slug)} className="underline">{m.name}</Link></span>)})</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-800">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
