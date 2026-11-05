import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PUBLISHED_GUIDES } from "@/server/content/guides";
import { INSTALL_GUIDES } from "@/server/content/install-guides";
import { guideStatuses } from "@/server/guides/status";
import { publicDocumentsLibrary } from "@/server/documents/queries";
import { DOCUMENT_KIND_FR as KIND_FR } from "@/server/documents/versions";

export const metadata: Metadata = { title: "Guides et installation", description: "Prise de mesures, choix d'une pergola, d'un screen ou d'une moustiquaire, toiles et motorisations, documents par modèle et guides d'installation validés.", alternates: { canonical: "/guides" } };

/** Guides pratiques et guides d'installation (seuls les guides validés techniquement et publiés sont listés). */
export default async function GuidesIndex() {
  const st = await guideStatuses();
  const installs = INSTALL_GUIDES.filter((g) => st.get(g.slug)?.status === "PUBLISHED");
  const docs = await publicDocumentsLibrary();
  const byFamily = [...new Set(docs.map((d) => d.familyName ?? ""))].map((name) => ({ name, docs: docs.filter((d) => (d.familyName ?? "") === name) }));
  const items = PUBLISHED_GUIDES;
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ label: "Guides et installation" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Guides et installation</h1>
      <p className="mt-3 max-w-2xl text-stone-800">Les points à vérifier avant de configurer et de commander.</p>
      <ul className="mt-10 grid gap-px overflow-hidden border border-sand-200 bg-sand-200 md:grid-cols-2">
        {items.map((g) => (
          <li key={g.href} className="card-link group bg-white p-6 transition-colors duration-150 hover:bg-sand-50">
            <h2 className="font-display text-xl font-semibold"><Link href={g.href} className="stretched">{g.title}</Link></h2>
            <p className="mt-2 text-sm text-stone-700">{g.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700" aria-hidden="true">Lire le guide <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" /></span>
          </li>
        ))}
      </ul>
      <section className="mt-14" aria-labelledby="documents" data-testid="documents-library">
        <h2 id="documents" className="font-display text-2xl font-semibold">Fiches techniques et notices</h2>
        {byFamily.length ? byFamily.map((g) => (
          <div key={g.name} className="mt-6"><h3 className="font-semibold">{g.name}</h3>
            <ul className="mt-2 space-y-1 text-sm">{g.docs.map((d) => <li key={d.id}>{d.href ? <a href={d.href} className="link-brand">{d.title}</a> : d.title} <span className="text-stone-700">— {KIND_FR[d.kind] ?? d.kind}, version {d.version}</span></li>)}</ul>
          </div>
        )) : <p className="mt-3 max-w-2xl text-stone-800" data-testid="documents-pending">Les documents des modèles sont publiés ici au fur et à mesure de leur validation. Une notice ou une fiche technique dont vous avez besoin ? Demandez-la à un <Link className="underline" href="/contact">conseiller</Link>.</p>}
      </section>
      <section className="mt-14" aria-labelledby="installation">
        <h2 id="installation" className="font-display text-2xl font-semibold">Installation</h2>
        {installs.length ? (
          <ul className="mt-6 grid gap-px overflow-hidden border border-sand-200 bg-sand-200 md:grid-cols-2" data-testid="install-guides">
            {installs.map((g) => <li key={g.slug} className="card-link bg-white p-6"><h3 className="font-display text-xl font-semibold"><Link href={`/guides/installation/${g.slug}`} className="stretched">{g.title}</Link></h3><p className="mt-2 text-sm text-stone-700">{g.summary}</p></li>)}
          </ul>
        ) : (
          <p className="mt-3 max-w-2xl text-stone-800" data-testid="install-guides-pending">Nos guides d'installation illustrés sont en cours de validation technique. En attendant, la notice officielle de montage, d'utilisation et de sécurité est remise avec chaque produit et disponible sur demande auprès d'un <Link className="underline" href="/contact">conseiller</Link>.</p>
        )}
      </section>
    </div>
  );
}
