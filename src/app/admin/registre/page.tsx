import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, StatusBadge, fmtDate } from "@/components/admin/ui";
import { updateLaunchInputAction } from "@/server/actions/admin/launch-inputs";

export const metadata: Metadata = { title: "Registre de lancement" };

const STATUS_FR = { OPEN: "Ouvert", ANSWERED: "Réponse reçue", VALIDATED: "Validé", WAIVED: "Sans objet" } as const;
const OWNER_FR = { CLIENT: "Client (HELIOSTORES)", SUPPLIER: "Fournisseur (via le client)", OPERATOR: "Exploitation du site" } as const;
const TONE = { OPEN: "warn", ANSWERED: "neutral", VALIDATED: "ok", WAIVED: "neutral" } as const;

/** Données attendues avant ou après le lancement : source, divergence, attente, responsable, conséquence, validation datée. */
export default async function LaunchRegisterPage(props: PageProps<"/admin/registre">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const items = await prisma.launchInput.findMany({ orderBy: [{ blocksLaunch: "desc" }, { sortOrder: "asc" }] });
  const open = items.filter((i) => i.status === "OPEN" || i.status === "ANSWERED");
  return (
    <div>
      <PageTitle title="Registre de lancement" />
      <Flash searchParams={props.searchParams} />
      <p className="mb-4 text-sm text-stone-700">{open.length} point(s) en attente, dont {open.filter((i) => i.blocksLaunch).length} bloquant l'ouverture publique. Une validation ne modifie pas le catalogue : la donnée validée est ensuite appliquée à la fiche, aux règles ou aux tarifs.</p>
      <ul className="space-y-4">
        {items.map((i) => (
          <li key={i.id} className="card p-4" data-testid={`launch-input-${i.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={TONE[i.status]}>{STATUS_FR[i.status]}</StatusBadge>
              {i.blocksLaunch && <StatusBadge tone="err">Bloque l'ouverture</StatusBadge>}
              <span className="text-xs text-stone-700">{i.area} · {i.product}</span>
            </div>
            <h2 className="mt-2 font-semibold">{i.subject}</h2>
            <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">
              {i.sources && <><dt className="text-stone-700">Sources</dt><dd>{i.sources}</dd></>}
              {i.divergence && i.divergence !== "—" && <><dt className="text-stone-700">Divergence</dt><dd>{i.divergence}</dd></>}
              <dt className="text-stone-700">Information attendue</dt><dd>{i.expected}</dd>
              <dt className="text-stone-700">Responsable</dt><dd>{OWNER_FR[i.owner]}</dd>
              <dt className="text-stone-700">Conséquence sur le site</dt><dd>{i.siteImpact}</dd>
              {i.validatedAt && <><dt className="text-stone-700">Validation</dt><dd>{fmtDate(i.validatedAt)} par {i.validatedBy ?? "—"}</dd></>}
            </dl>
            <form action={updateLaunchInputAction} className="mt-3 grid gap-2 sm:grid-cols-[12rem_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={i.id} />
              <div><label className="label" htmlFor={`st-${i.id}`}>Statut</label><select id={`st-${i.id}`} name="status" className="input" defaultValue={i.status}>{Object.entries(STATUS_FR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              <div><label className="label" htmlFor={`an-${i.id}`}>Réponse ou source (sans montant ni secret)</label><input id={`an-${i.id}`} name="answerNote" className="input" defaultValue={i.answerNote} maxLength={2000} /></div>
              <button className="btn-secondary" type="submit">Enregistrer</button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
