import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Notice } from "@/components/ui/alert";
import { CATEGORIES, configuratorHref, productHref } from "@/domain/categories";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Configurateurs", description: "Configurez une pergola, un screen ou un store banne HELIOSTORES à vos cotes, avec vue 3D indicative et prix selon vos dimensions." };

/**
 * Choix du configurateur. Les liens de l'ancien configurateur (`?gamme=`, `?projet=`, `?ligne=`) ne sont jamais
 * convertis automatiquement vers un nouveau modèle : un projet de l'ancien catalogue reste consultable dans le compte,
 * et le visiteur recommence explicitement une configuration.
 */
export default async function ConfiguratorIndex(props: PageProps<"/configurateur">) {
  const sp = await props.searchParams;
  const families = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, shortDescription: true, category: true }, orderBy: { sortOrder: "asc" } });
  if (typeof sp.gamme === "string" && families.some((f) => f.slug === sp.gamme)) redirect(configuratorHref(sp.gamme));
  const legacy = typeof sp.projet === "string" || typeof sp.ligne === "string" || typeof sp.gamme === "string";
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Configurateurs" }]} />
      <h1 className="mt-4 font-display text-4xl">Configurer votre projet</h1>
      <p className="mt-2 max-w-2xl text-stone-700">Choisissez un modèle : dimensions, pose, teinte et équipements vue 3D indicative, prix selon vos dimensions et demande de devis.</p>
      {legacy && <div className="mt-6" data-testid="legacy-notice"><Notice tone="warn">Ce lien concerne un produit de l&apos;ancien catalogue de démonstration, qui n&apos;est plus proposé. Vos projets et devis existants restent consultables dans votre compte ; pour poursuivre, recommencez une configuration avec l&apos;un des modèles ci-dessous.</Notice></div>}
      <div className="mt-8 grid gap-8">
        {CATEGORIES.map((c) => {
          const items = families.filter((f) => f.category === c.key);
          return (
            <section key={c.key} aria-labelledby={`cat-${c.key}`}>
              <h2 id={`cat-${c.key}`} className="font-display text-2xl">{c.label}</h2>
              {items.length === 0 ? <p className="mt-2 text-sm text-stone-700">Modèles en cours d&apos;intégration.</p> : (
                <ul className="mt-3 grid gap-4 md:grid-cols-2">
                  {items.map((f) => (
                    <li key={f.slug} className="card p-5">
                      <p className="font-medium">{f.name}</p>
                      <p className="mt-1 text-sm text-stone-700">{f.shortDescription}</p>
                      <div className="mt-3 flex flex-wrap gap-2"><Link href={configuratorHref(f.slug)} className="btn-accent">Configurer</Link><Link href={productHref(c.key, f.slug)} className="btn-ghost">Fiche produit</Link></div>
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
