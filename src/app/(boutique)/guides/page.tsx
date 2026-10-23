import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { GUIDES } from "@/server/content/guides";
import { INSTALL_GUIDES } from "@/server/content/install-guides";
import { guideStatuses } from "@/server/guides/status";

export const metadata: Metadata = { title: "Guides et installation", description: "Préparer votre projet de pergola, de screen ou de store banne, et guides d'installation validés.", alternates: { canonical: "/guides" } };

/** Guides pratiques et guides d'installation (seuls les guides validés techniquement et publiés sont listés). */
export default async function GuidesIndex() {
  const st = await guideStatuses();
  const installs = INSTALL_GUIDES.filter((g) => st.get(g.slug)?.status === "PUBLISHED");
  const items = [
    { href: "/guides/preparation-projet", title: "Préparer son projet et prendre les mesures", description: "Emplacement, cotes extérieur poteau à extérieur poteau, hauteur, pente, ancrage, câble 230 V, orientation, accès livraison et démarches : la liste de contrôle avant de commander." },
    ...Object.entries(GUIDES).map(([slug, g]) => ({ href: `/guides/${slug}`, title: g.title, description: g.description })),
  ];
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
