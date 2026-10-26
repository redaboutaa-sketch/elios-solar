import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AccountNav } from "@/components/account/account-nav";
import { Notice } from "@/components/ui/alert";
import { ChangePasswordForm } from "@/components/account/auth-forms";
export const metadata: Metadata = { title: "Mon compte", robots: { index: false } };
export default async function Page(props: PageProps<"/compte">) {
  const session = await requireUser("/compte");
  const sp = await props.searchParams;
  const [orders, projects, quotes] = await Promise.all([prisma.order.count({ where: { userId: session.user.id } }), prisma.configuration.count({ where: { ownerUserId: session.user.id } }), prisma.quote.count({ where: { userId: session.user.id } })]);
  return (
    <div className="container-x py-8">
      <h1 className="font-display text-4xl">Bonjour {session.user.name}</h1>
      <div className="mt-4"><AccountNav current="/compte" /></div>
      {sp.forbidden && <div className="mt-4"><Notice tone="error">Accès refusé : votre compte n'a pas les droits d'administration.</Notice></div>}
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[["/compte/commandes", "Commandes", orders], ["/compte/projets", "Projets sauvegardés", projects], ["/compte/devis", "Demandes de devis", quotes]].map(([h, l, n]) => <Link key={String(h)} href={String(h)} className="card p-5 hover:border-ink"><p className="text-3xl font-semibold">{n}</p><p className="text-stone-700">{l}</p></Link>)}
      </div>
      <section className="mt-10 max-w-md" aria-labelledby="securite-titre" id="securite">
        <h2 id="securite-titre" className="font-display text-2xl">Sécurité</h2>
        <div className="mt-3"><ChangePasswordForm /></div>
      </section>
    </div>
  );
}
