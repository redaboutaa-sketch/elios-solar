import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { UserRole } from "@/generated/prisma/enums";
import { Flash, Options, PageTitle, Pagination, ROLE_FR, Table, fmtDate } from "@/components/admin/ui";
import { changeRoleAction } from "@/server/actions/admin/users";

export const metadata: Metadata = { title: "Utilisateurs" };
const PER_PAGE = 50;

export default async function UsersPage(props: PageProps<"/admin/utilisateurs">) {
  const { session, role: myRole } = await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const role = typeof sp.role === "string" && sp.role in UserRole ? (sp.role as UserRole) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = { ...(q ? { email: { contains: q, mode: "insensitive" } } : {}), ...(role ? { role } : {}) };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER_PAGE, take: PER_PAGE, select: { id: true, email: true, name: true, role: true, createdAt: true, deletedAt: true, emailVerified: true } }),
  ]);
  const isAdmin = myRole === "ADMIN";
  return (
    <div>
      <PageTitle title="Utilisateurs" />
      <Flash searchParams={props.searchParams} />
      {!isAdmin && <p className="mb-3 text-sm text-stone-700">Seul un administrateur peut modifier les rôles.</p>}
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label" htmlFor="q">E-mail contient</label><input id="q" name="q" className="input" defaultValue={q} /></div>
        <div><label className="label" htmlFor="role">Rôle</label><select id="role" name="role" className="input" defaultValue={role ?? ""}><Options values={Object.values(UserRole)} labels={ROLE_FR} includeEmpty="Tous" /></select></div>
        <button className="btn-secondary" type="submit">Filtrer</button>
      </form>
      <Table caption="Utilisateurs">
        <thead><tr><th>E-mail</th><th>Nom</th><th>Inscription</th><th>Rôle</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="break-all">{u.email}{u.deletedAt && <span className="ml-1 text-xs text-danger">supprimé</span>}{!u.emailVerified && <span className="ml-1 text-xs text-stone-700">non vérifié</span>}</td>
              <td>{u.name}</td>
              <td>{fmtDate(u.createdAt, false)}</td>
              <td>
                {isAdmin && !u.deletedAt && u.id !== session.user.id ? (
                  <form action={changeRoleAction} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <label className="sr-only" htmlFor={`role-${u.id}`}>Rôle de {u.email}</label>
                    <select id={`role-${u.id}`} name="role" defaultValue={u.role} className="input w-44 py-1 min-h-0 text-sm"><Options values={Object.values(UserRole)} labels={ROLE_FR} /></select>
                    <button className="btn-secondary py-1 min-h-0" type="submit">Modifier</button>
                  </form>
                ) : <span>{ROLE_FR[u.role]}{u.id === session.user.id && " (vous)"}</span>}
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={4} className="text-stone-700">Aucun utilisateur.</td></tr>}
        </tbody>
      </Table>
      <Pagination page={page} pages={Math.ceil(total / PER_PAGE)} hrefFor={(p) => `/admin/utilisateurs?${new URLSearchParams({ ...(q ? { q } : {}), ...(role ? { role } : {}), page: String(p) })}`} />
    </div>
  );
}
