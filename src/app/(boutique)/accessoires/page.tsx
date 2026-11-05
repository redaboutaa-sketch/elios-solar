import type { Metadata } from "next";
import Link from "@/i18n/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CATEGORIES, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import type { OptionDef, SystemRules } from "@/domain/system";
import { prisma } from "@/lib/prisma";
import { publicSystemRules } from "@/domain/public-sanitize";
import { fmt } from "@/i18n/format";
import { getT } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT("catalog")).accessories;
  return { title: t.metaTitle, description: t.metaDescription, alternates: { canonical: "/accessoires" } };
}

type Fam = { slug: string; name: string; category: CategoryKey; rules: SystemRules };

type Msg = Awaited<ReturnType<typeof getT<"catalog">>>["accessories"];
type KindId = keyof Msg["kinds"];

/** Rubriques d'équipements : rattachement d'une option par son code, son groupe ou son rendu (titres et textes : messages « catalog.accessories.kinds »). */
const KINDS: Array<{ id: KindId; match: (o: OptionDef) => boolean; closure?: readonly string[] }> = [
  { id: "telecommandes", match: (o) => o.visual === "remote" || /remote/.test(o.code) },
  { id: "domotique", match: (o) => o.visual === "box" || /box/.test(o.code) },
  { id: "capteurs", match: (o) => o.visual === "wind_sensor" || /sensor|weather|wind/.test(o.code) },
  { id: "eclairage", match: (o) => o.group === "lighting" },
  { id: "fermetures", match: () => false, closure: ["sliding_glass", "sliding_panels"] },
];

const statusText = (t: Msg, o: { wish?: boolean; status: string }) => (o.wish ? t.status.wish : o.status === "to_confirm" ? t.status.toConfirm : t.status.documented);

export default async function AccessoriesPage() {
  const t = (await getT("catalog")).accessories;
  const labels = (await getT("layout")).categories;
  const rows = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] }, systemRules: { not: undefined } }, select: { slug: true, name: true, category: true, systemRules: true }, orderBy: { sortOrder: "asc" } });
  const fams: Fam[] = rows.filter((r) => r.systemRules).map((r) => ({ slug: r.slug, name: r.name, category: r.category as CategoryKey, rules: publicSystemRules(r.systemRules as unknown as SystemRules) }));
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: t.title }]} />
      <h1 className="mt-4 font-display text-display font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-3xl text-stone-700 text-pretty">{t.intro}</p>
      <nav aria-label={t.sectionsNav} className="mt-6 flex flex-wrap gap-2 text-sm">{KINDS.map((k) => <a key={k.id} href={`#${k.id}`} className="btn-secondary px-3 py-1.5">{t.kinds[k.id].title}</a>)}<a href="#vent" className="btn-secondary px-3 py-1.5">{t.windNav}</a></nav>
      {KINDS.map((k) => {
        const list = fams.flatMap((f) => {
          const opts = f.rules.options.filter(k.match).map((o) => ({ label: o.label, status: statusText(t, o), prereq: o.prerequisite }));
          const incl = k.id === "telecommandes" ? f.rules.included.filter((i) => /télécommande|émetteur/i.test(i.label)).map((i) => ({ label: i.label, status: i.status === "to_confirm" ? t.status.includedToConfirm : t.status.included, prereq: undefined })) : [];
          const closures = k.closure ? (f.rules.closureWishes ?? []).filter((w) => k.closure!.includes(w.familySlug)).map((w) => ({ label: w.label, status: w.note, prereq: undefined })) : [];
          const all = [...incl, ...opts, ...closures];
          return all.length ? [{ f, all }] : [];
        });
        return (
          <section key={k.id} id={k.id} className="section-y scroll-mt-24 border-t border-sand-200" aria-labelledby={`${k.id}-t`} data-testid={`acc-${k.id}`}>
            <h2 id={`${k.id}-t`} className="font-display text-2xl font-semibold">{t.kinds[k.id].title}</h2>
            <p className="mt-2 max-w-3xl text-stone-700">{t.kinds[k.id].intro}</p>
            {list.length === 0 ? <p className="mt-4 text-sm text-stone-700">{t.none}</p> : (
              <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-sand-300 text-stone-700"><tr><th className="py-2 pr-4 font-medium">{t.model}</th><th className="py-2 pr-4 font-medium">{t.equipment}</th><th className="py-2 font-medium">{t.statusCol}</th></tr></thead>
                <tbody>{list.flatMap(({ f, all }) => all.map((o, i) => (
                  <tr key={`${f.slug}-${i}`} className="border-b border-sand-200 align-top">
                    <td className="py-2 pr-4">{i === 0 ? <Link href={productHref(f.category, f.slug)} className="link-brand">{f.name}</Link> : null}</td>
                    <td className="py-2 pr-4">{o.label}{o.prereq ? <span className="block text-xs text-stone-700">{fmt(t.prereq, { prereq: o.prereq })}</span> : null}</td>
                    <td className="py-2 text-stone-800">{o.status}</td>
                  </tr>
                )))}</tbody>
              </table></div>
            )}
          </section>
        );
      })}
      <section id="vent" className="section-y scroll-mt-24 border-t border-sand-200" aria-labelledby="vent-t" data-testid="acc-vent">
        <h2 id="vent-t" className="font-display text-2xl font-semibold">{t.windTitle}</h2>
        <p className="mt-2 max-w-3xl text-stone-700">{t.windIntro}</p>
        {CATEGORIES.map((c) => {
          const items = fams.filter((f) => f.category === c.key && f.rules.wind);
          return items.length ? (
            <div key={c.key} className="mt-6"><h3 className="font-semibold">{labels[c.key]}</h3>
              <ul className="mt-2 space-y-2 text-sm">{items.map((f) => <li key={f.slug}><Link href={configuratorHref(f.slug)} className="link-brand">{f.name}</Link>{f.rules.wind!.status === "to_confirm" ? t.toConfirmParen : ""} : {f.rules.wind!.text}</li>)}</ul>
            </div>
          ) : null;
        })}
      </section>
      <p className="mt-8 text-sm text-stone-700">{t.footerBefore}<Link href="/contact" className="underline">{t.footerAdvice}</Link>{t.footerMiddle}<Link href="/guides/choisir-toile-et-motorisation" className="underline">{t.footerGuide}</Link>{t.footerAfter}</p>
    </div>
  );
}
