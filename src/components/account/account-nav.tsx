import Link from "next/link";
import { SignOutButton } from "./auth-forms";
export function AccountNav({ current }: { current: string }) {
  const items = [["/compte", "Vue d'ensemble"], ["/compte/commandes", "Commandes"], ["/compte/projets", "Projets"], ["/compte/devis", "Devis"], ["/compte/documents", "Documents"], ["/compte/echanges", "Mes échanges"], ["/compte/donnees", "Mes données"]];
  return <nav aria-label="Compte" className="flex flex-wrap gap-2 items-center">{items.map(([h, l]) => <Link key={h} href={h!} aria-current={current === h ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm min-h-11 inline-flex items-center ${current === h ? "bg-anthracite text-sand-50" : "bg-white border border-sand-300"}`}>{l}</Link>)}<SignOutButton /></nav>;
}
