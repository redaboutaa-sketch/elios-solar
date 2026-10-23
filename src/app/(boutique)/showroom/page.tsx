import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PUBLIC_SECTIONS } from "@/config/brand";
import { prisma } from "@/lib/prisma";
export const metadata: Metadata = { title: "Showroom", description: "Venez voir nos pergolas et stores bannes en situation." };
/** Rubrique masquée tant qu'aucun contenu réel n'est fourni (PUBLIC_SECTIONS). */
export default async function Page() {
  if (!PUBLIC_SECTIONS.showroom) notFound();
  const rooms = await prisma.showroom.findMany({ where: { published: true } });
  return (
    <div className="container-x py-8"><Breadcrumbs items={[{ label: "Showroom" }]} /><h1 className="mt-4 font-display text-4xl">Showroom</h1>
      {rooms.length === 0 ? <div className="mt-8 card p-10 text-center"><p className="font-display text-2xl">Aucun showroom publié pour le moment.</p><p className="mt-2 text-stone-700">Découvrez les produits en visio avec un conseiller : <Link href="/rappel" className="underline">demandez un rappel</Link>.</p></div> : <ul className="mt-8 grid gap-6 md:grid-cols-2">{rooms.map((r) => <li key={r.id} className="card p-5"><h2 className="font-display text-xl">{r.name}</h2><p>{r.line1}, {r.postalCode} {r.city}</p><p className="text-sm text-stone-700">{r.hours}{r.phone ? ` · ${r.phone}` : ""}</p></li>)}</ul>}
    </div>
  );
}
