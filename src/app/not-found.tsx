import Link from "next/link";
export default function NotFound() {
  return <div className="container-x py-24 text-center"><h1 className="font-display text-4xl">Page introuvable</h1><p className="mt-2 text-stone-700">Cette page n'existe pas ou n'est plus disponible.</p><Link href="/" className="btn-primary mt-6">Retour à l'accueil</Link></div>;
}
