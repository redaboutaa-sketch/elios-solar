import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { AdminMobileNav, AdminNav } from "@/components/admin/admin-nav";
import { ROLE_FR } from "@/components/admin/ui";
import { touchPresence } from "@/server/chat/service";
import { PresencePing } from "@/components/chat/presence-ping";

export const metadata: Metadata = { title: { default: "Administration", template: "%s — Administration" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { session, role } = await requireRole(["ADMIN", "MANAGER"]);
  // présence des conseillers pour le chat : au plus une écriture par minute
  await touchPresence(session.user.id).catch(() => undefined);
  return (
    <div className="flex min-h-dvh flex-col bg-sand-50 text-ink">
      <div role="note" className="bg-anthracite px-4 py-1.5 text-center text-xs tracking-wide text-sand-50">Administration — préproduction</div>
      <header className="border-b border-sand-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 lg:px-6">
          <Link href="/admin" className="font-display text-lg">ELIOS SOLAR · Administration</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden sm:inline text-stone-700">{session.user.name || "Compte"} · {ROLE_FR[role] ?? role}</span>
            <Link href="/" className="underline">Retour à la boutique</Link>
          </div>
        </div>
      </header>
      <AdminMobileNav />
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-sand-200 bg-sand-100/60 lg:block">
          <nav aria-label="Administration" className="sticky top-0 max-h-dvh overflow-y-auto p-3"><AdminNav /></nav>
        </aside>
        <main id="contenu" className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
        <PresencePing />
      </div>
    </div>
  );
}
