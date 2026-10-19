import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CustomConfigurator } from "@/components/configurator/custom-configurator";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";

export const metadata: Metadata = { title: "Pergola sur mesure", description: "Pergola bioclimatique à vos cotes : largeur, longueur, hauteur, finition et fermetures par côté. Étude et devis." };

export default async function CustomPage() {
  const catalog = await ensureCatalogSnapshot();
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/configurateur", label: "Configurateur" }, { label: "Sur mesure" }]} />
      <h1 className="mt-4 font-display text-4xl">Pergola sur mesure</h1>
      <p className="mt-2 text-stone-700 max-w-2xl">Indiquez vos cotes et vos souhaits : nous établissons un devis après étude. {catalog.custom.quoteOnly ? "Aucun prix n'est affiché tant que la grille fournisseur n'est pas validée." : ""}</p>
      <div className="mt-8"><CustomConfigurator catalog={catalog} /></div>
    </div>
  );
}
