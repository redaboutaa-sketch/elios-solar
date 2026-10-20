import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FamilyCard } from "@/components/catalog/family-card";
import { listFamilies } from "@/server/catalog/queries";

export const metadata: Metadata = { title: "Stores bannes", description: "Stores bannes coffre intégral motorisés avec éclairage LED et télécommande, dans les tailles réellement disponibles." };

export default async function StoresPage() {
  const list = await listFamilies(["AWNING"]);
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Stores bannes" }]} />
      <h1 className="mt-4 font-display text-4xl">Stores bannes</h1>
      <p className="mt-2 text-stone-700 max-w-2xl">Un configurateur dédié : largeur, avancée, couleur du coffre et de la toile, supports muraux ou plafond, anémomètre en option.</p>
      {list.length === 0 ? <p className="mt-10 card p-10 text-center">Aucun store banne publié pour le moment.</p> : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{list.map((f) => <FamilyCard key={f.slug} f={f} href={`/stores-bannes/${f.slug}`} />)}</div>
      )}
    </div>
  );
}
