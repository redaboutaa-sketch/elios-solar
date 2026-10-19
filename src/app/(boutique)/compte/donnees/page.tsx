import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { AccountNav } from "@/components/account/account-nav";
import { Notice } from "@/components/ui/alert";
import { deleteAccountAction, exportDataAction } from "@/server/actions/account";
export const metadata: Metadata = { title: "Mes données", robots: { index: false } };
export default async function Page(props: PageProps<"/compte/donnees">) {
  await requireUser("/compte/donnees");
  const sp = await props.searchParams;
  return (
    <div className="container-x py-8 max-w-3xl"><h1 className="font-display text-4xl">Mes données personnelles</h1><div className="mt-4"><AccountNav current="/compte/donnees" /></div>
      {sp.export && <div className="mt-4"><Notice tone="success">Votre export est en cours d'envoi par e-mail.</Notice></div>}
      {sp.erreur && <div className="mt-4"><Notice tone="error">Saisissez SUPPRIMER pour confirmer.</Notice></div>}
      <section className="mt-8 card p-5"><h2 className="font-display text-2xl">Exporter mes données</h2><p className="mt-2 text-sm text-stone-700">Compte, adresses, commandes, devis, projets et consentements au format JSON, envoyés à votre adresse e-mail.</p><form action={exportDataAction}><button className="btn-secondary mt-3">Recevoir mon export</button></form></section>
      <section className="mt-6 card p-5 border-danger/40"><h2 className="font-display text-2xl">Supprimer mon compte</h2><p className="mt-2 text-sm text-stone-700">Vos projets, panier, adresses et consentements sont supprimés. Les commandes payées sont conservées anonymisées pendant 10 ans (obligations comptables) ; les devis sont anonymisés.</p><form action={deleteAccountAction} className="mt-3 flex flex-wrap gap-2 items-end"><div><label className="label" htmlFor="confirm">Tapez SUPPRIMER</label><input id="confirm" name="confirm" className="input" autoComplete="off" /></div><button className="btn bg-danger text-white hover:bg-danger/90">Supprimer définitivement</button></form></section>
    </div>
  );
}
