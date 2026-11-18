import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { PUBLIC_SECTIONS } from "@/config/brand";
import { requireRole } from "@/lib/session";
import type { Showroom } from "@/generated/prisma/client";
import { Flash, PageTitle, Section, StatusBadge } from "@/components/admin/ui";
import { deleteShowroomAction, saveShowroomAction } from "@/server/actions/admin/content";

export const metadata: Metadata = { title: "Showroom" };

function ShowroomForm({ s }: { s: Showroom | null }) {
  const p = s ? `s-${s.id}` : "s-new";
  return (
    <form action={saveShowroomAction} className="grid gap-3 md:grid-cols-2">
      {s && <input type="hidden" name="id" value={s.id} />}
      <div><label className="label" htmlFor={`${p}-n`}>Nom</label><input id={`${p}-n`} name="name" required maxLength={160} className="input" defaultValue={s?.name ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-ph`}>Téléphone</label><input id={`${p}-ph`} name="phone" maxLength={30} className="input" defaultValue={s?.phone ?? ""} /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${p}-a`}>Adresse</label><input id={`${p}-a`} name="line1" required maxLength={200} className="input" defaultValue={s?.line1 ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-cp`}>Code postal</label><input id={`${p}-cp`} name="postalCode" required maxLength={10} className="input" defaultValue={s?.postalCode ?? ""} /></div>
      <div><label className="label" htmlFor={`${p}-c`}>Ville</label><input id={`${p}-c`} name="city" required maxLength={120} className="input" defaultValue={s?.city ?? ""} /></div>
      <div className="md:col-span-2"><label className="label" htmlFor={`${p}-h`}>Horaires</label><textarea id={`${p}-h`} name="hours" rows={3} className="input" defaultValue={s?.hours ?? ""} /></div>
      <div className="flex flex-wrap items-center gap-4 text-sm md:col-span-2">
        <label className="flex items-center gap-2"><input type="checkbox" name="published" className="h-4 w-4" defaultChecked={s?.published ?? false} /> Publié</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="isDemo" className="h-4 w-4" defaultChecked={s?.isDemo ?? true} /> Démonstration</label>
      </div>
      <div className="md:col-span-2"><button className="btn-primary" type="submit">{s ? "Enregistrer" : "Ajouter le showroom"}</button></div>
    </form>
  );
}

export default async function ShowroomAdminPage(props: PageProps<"/admin/contenus/showroom">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const items = await prisma.showroom.findMany({ orderBy: { name: "asc" } });
  return (
    <div className="space-y-6">
      <PageTitle title="Showroom" />
      {!PUBLIC_SECTIONS.showroom && <p className="mb-4 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning" data-testid="section-hidden">Rubrique masquée sur le site public (page en 404) tant qu'aucun contenu réel et autorisé n'est fourni. Les fiches restent modifiables ici.</p>}
      <Flash searchParams={props.searchParams} />
      {items.map((s) => (
        <Section key={s.id}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="font-display text-xl">{s.name}</h2>
            {s.published ? <StatusBadge tone="ok">Publié</StatusBadge> : <StatusBadge tone="neutral">Masqué</StatusBadge>}
            {s.isDemo && <StatusBadge tone="demo">Démo</StatusBadge>}
            <form action={deleteShowroomAction} className="ml-auto"><input type="hidden" name="id" value={s.id} /><button className="btn-ghost py-1 min-h-0 text-danger" type="submit">Supprimer</button></form>
          </div>
          <ShowroomForm s={s} />
        </Section>
      ))}
      <Section title="Nouveau showroom"><ShowroomForm s={null} /></Section>
    </div>
  );
}
