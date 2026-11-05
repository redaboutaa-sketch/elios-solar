import type { Metadata } from "next";
import Link from "@/i18n/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Notice } from "@/components/ui/alert";
import { CATEGORIES, configuratorHref, productHref } from "@/domain/categories";
import { prisma } from "@/lib/prisma";
import { FamilySketch } from "@/components/illustrations/sketches";
import { ArrowRight } from "lucide-react";
import { getT, localePath } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = (await getT("configurator")).index;
  return { title: t.metaTitle, description: t.metaDescription, robots: { index: false, follow: true } };
}

/**
 * Choix du configurateur. Les liens de l'ancien configurateur (`?gamme=`, `?projet=`, `?ligne=`) ne sont jamais
 * convertis automatiquement vers un nouveau modèle : un projet de l'ancien catalogue reste consultable dans le compte,
 * et le visiteur recommence explicitement une configuration.
 */
export default async function ConfiguratorIndex(props: PageProps<"/configurateur">) {
  const sp = await props.searchParams;
  const t = (await getT("configurator")).index;
  const categories = (await getT("layout")).categories;
  const families = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, shortDescription: true, category: true }, orderBy: { sortOrder: "asc" } });
  if (typeof sp.gamme === "string" && families.some((f) => f.slug === sp.gamme)) redirect(await localePath(configuratorHref(sp.gamme)));
  const legacy = typeof sp.projet === "string" || typeof sp.ligne === "string" || typeof sp.gamme === "string";
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: t.breadcrumb }]} />
      <h1 className="mt-4 font-display text-display font-semibold">{t.title}</h1>
      <p className="mt-2 max-w-2xl text-stone-700">{t.intro}</p>
      {legacy && <div className="mt-6" data-testid="legacy-notice"><Notice tone="warn">{t.legacy}</Notice></div>}
      <div className="mt-8 divide-y divide-sand-200 border-t border-sand-200">
        {CATEGORIES.map((c) => {
          const items = families.filter((f) => f.category === c.key);
          return (
            <section key={c.key} aria-labelledby={`cat-${c.key}`} className="grid gap-4 py-8 md:grid-cols-[12rem_1fr] md:gap-8">
              <div>
                <FamilySketch kind={c.key} sun={false} animated={false} className="w-40 md:w-full" />
                <h2 id={`cat-${c.key}`} className="mt-1 font-display text-2xl font-semibold">{categories[c.key] ?? c.label}</h2>
              </div>
              {items.length === 0 ? <p className="mt-2 text-sm text-stone-700">{t.comingSoon}</p> : (
                <ul className="grid content-start gap-4 lg:grid-cols-2">
                  {items.map((f) => (
                    <li key={f.slug} className="rounded-2xl border border-sand-200 bg-white p-5 transition-colors duration-150 hover:border-brand-700/50">
                      <p className="font-display text-lg font-semibold">{f.name}</p>
                      <p className="mt-1 text-sm text-stone-700">{f.shortDescription}</p>
                      <div className="mt-3 flex flex-wrap gap-2"><Link href={configuratorHref(f.slug)} className="btn-accent">{t.configure} <ArrowRight className="size-4" aria-hidden="true" /></Link><Link href={productHref(c.key, f.slug)} className="btn-ghost">{t.productSheet}</Link></div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
