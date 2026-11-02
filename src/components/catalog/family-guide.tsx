import Link from "@/i18n/link";
import { ArrowRight } from "lucide-react";
import type { CategoryKey } from "@/domain/categories";
import { productHref } from "@/domain/categories";
import { dimRangeText } from "@/domain/system";
import type { listSystemFamilies } from "@/server/catalog/systems";
import { productNature } from "@/server/seo/product-nature";
import { catalog } from "@/i18n/messages/catalog";
import { fmt } from "@/i18n/format";
import { getT } from "@/i18n/server";

type Item = Awaited<ReturnType<typeof listSystemFamilies>>[number];
type Faq = { q: string; a?: string; before?: string; link?: string; after?: string };

/**
 * Contenu éditorial d'une page de famille : usages, aide au choix (calculée depuis les règles documentées de chaque
 * modèle), définitions, prise de mesures, déroulement de la demande, questions fréquentes et guides applicables.
 * Aucune zone desservie, garantie, délai ou prix n'est affirmé ; un point « à confirmer » reste présenté comme tel.
 * Textes : src/i18n/messages/catalog.ts (familyGuide.content) ; les liens des réponses sont définis ici.
 */
const FAQ_LINKS: Partial<Record<CategoryKey, Record<string, string>>> = {
  PERGOLAS: { permit: "/guides/autorisation-urbanisme" },
  MOUSTIQUAIRES: { measure: "/guides/prise-de-mesures" },
};

export function modelSummary(f: Item, t: (typeof catalog)["fr"]["familyGuide"]["summary"] = catalog.fr.familyGuide.summary): string {
  const r = f.rules;
  const nature = productNature(r) ?? "";
  const dims = [`${r.dims.width.label.toLowerCase()} ${dimRangeText(r.dims.width)}`, r.dims.depth ? `${r.dims.depth.label.toLowerCase()} ${dimRangeText(r.dims.depth)}` : null, r.dims.height ? `${r.dims.height.label.toLowerCase()} ${dimRangeText(r.dims.height)}` : null].filter(Boolean).join(", ");
  const poses = r.mountings.filter((m) => m.status !== "to_confirm").map((m) => m.label.toLowerCase());
  const made = r.fixedSizes?.length ? t.fixedSizes : t.madeToMeasure;
  return `${nature}${nature ? ", " : ""}${made}${poses.length ? fmt(t.mounting, { list: poses.join(t.or) }) : ""}${t.sep}${dims}.`;
}

export async function FamilyGuide({ category, items }: { category: CategoryKey; items: Item[] }) {
  const t = (await getT("catalog")).familyGuide;
  const c = t.content[category];
  const s = t.steps;
  const faq = Object.entries(c.faq as Record<string, Faq>);
  return (
    <div data-testid="family-guide">
      <section className="section-y border-t border-sand-200" aria-labelledby="usages">
        <h2 id="usages" className="font-display text-display font-semibold">{t.usagesTitle}</h2>
        <ul className="mt-4 max-w-3xl list-disc space-y-1 pl-5 text-stone-800">{Object.values(c.usages).map((u) => <li key={u}>{u}</li>)}</ul>
        {items.length > 0 && (
          <>
            <h3 className="mt-8 font-display text-xl font-semibold">{t.whichModel}</h3>
            <ul className="mt-3 max-w-3xl space-y-2 text-stone-800">{items.map((f) => <li key={f.slug}><Link href={productHref(category, f.slug)} className="font-semibold link-brand">{f.name}</Link> : {modelSummary(f, t.summary)}{f.rules.notices?.[0] && f.rules.notices[0].length < 200 ? ` ${f.rules.notices[0]}` : ""}</li>)}</ul>
            <p className="mt-3 max-w-3xl text-sm text-stone-700">{t.whichModelNote}</p>
          </>
        )}
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="definitions">
        <h2 id="definitions" className="font-display text-display font-semibold">{t.termsTitle}</h2>
        <dl className="mt-4 grid max-w-4xl gap-x-8 gap-y-4 md:grid-cols-2">{Object.values(c.terms).map(({ term, def }) => <div key={term}><dt className="font-semibold">{term}</dt><dd className="mt-1 text-sm text-stone-800">{def}</dd></div>)}</dl>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="deroulement">
        <h2 id="deroulement" className="font-display text-display font-semibold">{t.stepsTitle}</h2>
        <ol className="mt-4 grid max-w-5xl gap-4 md:grid-cols-4">
          {[
            [s.measure, <>{s.measureBefore}<Link href="/guides/prise-de-mesures" className="link-brand">{s.measureLink}</Link>{s.measureAfter}</>],
            [s.configure, s.configureText],
            [s.send, s.sendText],
            [s.receive, s.receiveText],
          ].map(([title, d], i) => <li key={String(title)} className="border border-sand-200 bg-white p-5"><p className="text-sm font-semibold text-brand-700">{fmt(t.step, { n: i + 1 })}</p><p className="mt-1 font-display text-lg font-semibold">{title}</p><p className="mt-1 text-sm text-stone-800">{d}</p></li>)}
        </ol>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="questions">
        <h2 id="questions" className="font-display text-display font-semibold">{t.faqTitle}</h2>
        <div className="mt-4 max-w-3xl divide-y divide-sand-200 border-y border-sand-200">{faq.map(([id, q]) => {
          const href = FAQ_LINKS[category]?.[id];
          return <details key={q.q} className="py-3"><summary className="cursor-pointer font-medium">{q.q}</summary><div className="mt-2 text-stone-800">{href && q.link ? <>{q.before}<Link href={href} className="link-brand">{q.link}</Link>{q.after}</> : q.a}</div></details>;
        })}</div>
      </section>
      <section className="section-y border-t border-sand-200" aria-labelledby="guides-lies">
        <h2 id="guides-lies" className="font-display text-display font-semibold">{t.guidesTitle}</h2>
        <ul className="mt-4 flex flex-wrap gap-3">{Object.entries(c.guides as Record<string, string>).map(([href, label]) => <li key={href}><Link href={href} className="btn-secondary">{label} <ArrowRight className="size-4" aria-hidden="true" /></Link></li>)}</ul>
      </section>
    </div>
  );
}
