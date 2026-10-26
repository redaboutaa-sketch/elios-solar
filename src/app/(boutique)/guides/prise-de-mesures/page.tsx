import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { MeasureTool, type MeasureModel } from "@/components/guides/measure-tool";
import { prisma } from "@/lib/prisma";
import { publicSystemRules } from "@/domain/public-sanitize";
import type { SystemRules } from "@/domain/system";
import type { CategoryKey } from "@/domain/categories";

export const metadata: Metadata = { title: "Prise de mesures", description: "Comment mesurer pour une pergola, un screen, un store banne ou une moustiquaire, selon le type de pose, et reporter vos mesures dans le configurateur.", alternates: { canonical: "/guides/prise-de-mesures" } };

export default async function MeasurePage() {
  const rows = await prisma.productFamily.findMany({ where: { category: { not: null }, legacy: false, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, category: true, systemRules: true }, orderBy: { sortOrder: "asc" } });
  const models: MeasureModel[] = rows.filter((r) => r.systemRules).map((r) => ({ slug: r.slug, name: r.name, category: r.category as CategoryKey, rules: publicSystemRules(r.systemRules as unknown as SystemRules) }));
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ href: "/guides", label: "Guides et installation" }, { label: "Prise de mesures" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Prise de mesures</h1>
      <p className="mt-3 max-w-3xl text-stone-800 text-pretty">Choisissez votre famille, votre modèle et votre type de pose : le schéma indique ce qu'il faut mesurer. Vos mesures sont comparées aux dimensions documentées du modèle, puis reportées dans le configurateur. Elles restent indicatives : un conseiller les vérifie avec vous lors de l'étude du devis.</p>
      <div className="mt-8"><MeasureTool models={models} /></div>
      <p className="mt-10 text-sm text-stone-700">Voir aussi : <Link href="/guides/preparation-projet" className="underline">préparer son projet</Link>.</p>
    </div>
  );
}
