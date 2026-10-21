import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { GUIDES } from "@/server/content/guides";

export const metadata: Metadata = { title: "Guides", description: "Guides pratiques pour préparer votre projet de pergola, de screen ou de store banne.", alternates: { canonical: "/guides" } };

/** Index des guides existants (contenu inchangé, page de navigation). */
export default function GuidesIndex() {
  const items = [
    { href: "/guides/preparation-projet", title: "Préparer son projet et prendre les mesures", description: "Emplacement, cotes extérieur poteau à extérieur poteau, hauteur, pente, ancrage, câble 230 V, orientation, accès livraison et démarches : la liste de contrôle avant de commander." },
    ...Object.entries(GUIDES).map(([slug, g]) => ({ href: `/guides/${slug}`, title: g.title, description: g.description })),
  ];
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ label: "Guides" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Guides</h1>
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
    </div>
  );
}
