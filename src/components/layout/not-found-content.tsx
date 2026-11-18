import Link from "next/link";
import { CATEGORIES } from "@/domain/categories";

/** Contenu de la page 404 : orientation vers les familles, les guides et le devis. */
export function NotFoundContent() {
  return (
    <div className="container-x py-20 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-2 font-display text-4xl font-semibold">Page introuvable</h1>
      <p className="mx-auto mt-3 max-w-xl text-stone-700">Cette page n&apos;existe pas ou n&apos;est plus disponible. Un modèle a peut-être changé de nom ou quitté le catalogue : retrouvez la gamme actuelle ci-dessous.</p>
      <nav aria-label="Familles de produits" className="mt-8">
        <ul className="flex flex-wrap justify-center gap-3">{CATEGORIES.map((c) => <li key={c.key}><Link href={c.href} className="btn-secondary">{c.label}</Link></li>)}</ul>
      </nav>
      <p className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/guides" className="btn-ghost">Guides et installation</Link><Link href="/devis" className="btn-accent">Demander un devis</Link><Link href="/" className="btn-ghost">Accueil</Link></p>
    </div>
  );
}
