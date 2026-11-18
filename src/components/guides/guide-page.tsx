import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { BRAND } from "@/config/brand";
import { breadcrumbJsonLd } from "@/server/seo/structured-data";

import { GUIDES_UPDATED } from "@/server/content/guides";

/** Gabarit d'un guide : fil d'Ariane (et son balisage), titre, date de mise à jour réelle, contenu, guides liés. */
export function GuidePage({ path, title, intro, related = [], children }: { path: string; title: string; intro: string; related?: Array<[string, string]>; children: React.ReactNode }) {
  const updated = new Date(`${GUIDES_UPDATED}T12:00:00Z`);
  return (
    <article className="container-x py-10">
      <Breadcrumbs items={[{ href: "/guides", label: "Guides et installation" }, { label: title }]} />
      <h1 className="mt-5 font-display text-display font-semibold">{title}</h1>
      <p className="mt-3 max-w-3xl text-lg text-stone-800 text-pretty">{intro}</p>
      <p className="mt-2 text-sm text-stone-700">Mis à jour le <time dateTime={GUIDES_UPDATED}>{updated.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}</time>, d&apos;après la documentation des modèles du catalogue. Les points « à confirmer » sont vérifiés au devis.</p>
      <div className="mt-8">{children}</div>
      {related.length > 0 && (
        <nav aria-label="Guides liés" className="mt-12 border-t border-sand-200 pt-6"><p className="font-medium">Pour aller plus loin</p><ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">{related.map(([href, label]) => <li key={href}><Link href={href} className="link-brand">{label}</Link></li>)}</ul></nav>
      )}
      <p className="mt-8 flex flex-wrap gap-3"><Link href="/configurateur" className="btn-accent">Configurer mon projet</Link><Link href="/devis" className="btn-secondary">Demander un devis</Link><Link href="/contact" className="btn-ghost">Demander conseil</Link></p>
      <JsonLd data={breadcrumbJsonLd(BRAND.siteUrl, [{ name: "Guides et installation", path: "/guides" }, { name: title, path }])} />
    </article>
  );
}
