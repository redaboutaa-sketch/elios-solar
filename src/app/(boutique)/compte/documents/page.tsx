import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AccountNav } from "@/components/account/account-nav";
import { DocumentList } from "@/components/catalog/document-list";
import { customerDocuments, familyIdsOrderedBy } from "@/server/documents/queries";

export const metadata: Metadata = { title: "Mes documents", robots: { index: false } };

export default async function Page() {
  const session = await requireUser("/compte/documents");
  const [docs, families] = await Promise.all([customerDocuments(session.user.id), familyIdsOrderedBy(session.user.id)]);
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-4xl">Mes documents</h1>
      <div className="mt-4"><AccountNav current="/compte/documents" /></div>
      <p className="mt-6 max-w-2xl text-stone-700">Notices, fiches et documents des produits que vous avez commandés{families.length === 0 ? " (aucune commande pour le moment : seuls les documents généraux s'affichent)" : ""}. Seules les versions validées et publiées apparaissent ici.</p>
      <section className="mt-6"><DocumentList docs={docs} showFamily empty="Aucun document publié pour vos produits pour le moment. Les notices fournisseur seront ajoutées dès leur validation." /></section>
      <section className="mt-10 card p-5">
        <h2 className="font-display text-xl">Préparer l'installation</h2>
        <p className="mt-2 text-sm text-stone-800">Emplacement, prise de mesures, support d'ancrage, alimentation électrique, accès livraison : la liste de contrôle avant la pose.</p>
        <p className="mt-3"><Link href="/guides/preparation-projet" className="btn-secondary">Lire le guide de préparation</Link></p>
      </section>
    </div>
  );
}
