import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Pagination, Table, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Journal" };
const PER_PAGE = 50;

function Json({ value }: { value: unknown }) {
  if (value == null) return <span className="text-stone-700">—</span>;
  const s = JSON.stringify(value, null, 1);
  return (
    <details>
      <summary className="cursor-pointer text-xs underline">{s.length > 60 ? `${s.slice(0, 60).replace(/\s+/g, " ")}…` : s.replace(/\s+/g, " ")}</summary>
      <pre className="mt-1 max-h-64 max-w-md overflow-auto rounded bg-sand-100 p-2 text-xs">{s}</pre>
    </details>
  );
}

export default async function JournalPage(props: PageProps<"/admin/journal">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const entite = typeof sp.entite === "string" ? sp.entite.slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where = entite ? { entity: entite } : {};
  const [total, logs, entities] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE }),
    prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } }),
  ]);
  return (
    <div>
      <PageTitle title="Journal d'audit" />
      <Flash searchParams={props.searchParams} />
      <form method="get" className="mb-4 flex items-end gap-3">
        <div><label className="label" htmlFor="entite">Entité</label><select id="entite" name="entite" className="input" defaultValue={entite}><option value="">Toutes</option>{entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity}</option>)}</select></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <p className="mb-2 text-sm text-stone-700">{total} entrée(s)</p>
      <Table caption="Journal d'audit">
        <thead><tr><th>Date</th><th>Auteur</th><th>Action</th><th>Entité</th><th>Avant</th><th>Après</th></tr></thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td className="whitespace-nowrap">{fmtDate(l.createdAt)}</td>
              <td className="text-xs break-all">{l.actorEmail ?? l.actorUserId ?? "système"}</td>
              <td className="font-mono text-xs">{l.action}</td>
              <td className="text-xs">{l.entity}{l.entityId && <span className="block font-mono text-stone-700">{l.entityId}</span>}</td>
              <td><Json value={l.before} /></td>
              <td><Json value={l.after} /></td>
            </tr>
          ))}
          {logs.length === 0 && <tr><td colSpan={6} className="text-stone-700">Aucune entrée.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/journal?${new URLSearchParams({ ...(entite ? { entite } : {}), page: String(p) })}`} />
    </div>
  );
}
