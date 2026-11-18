import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { contentVars } from "@/server/admin/launch";
import { Flash, PageTitle, StatusBadge, Table, fmtDate } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Pages de contenu" };

export default async function ContentPagesPage(props: PageProps<"/admin/contenus/pages">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const [pages, settings] = await Promise.all([prisma.contentPage.findMany({ orderBy: { slug: "asc" } }), prisma.siteSettings.findUnique({ where: { id: 1 } })]);
  const vars = contentVars(settings);
  return (
    <div>
      <PageTitle title="Pages de contenu" />
      <Flash searchParams={props.searchParams} />
      <Table caption="Pages de contenu">
        <thead><tr><th>Page</th><th>Statut</th><th>Champs manquants</th><th>Mise à jour</th></tr></thead>
        <tbody>
          {pages.map((p) => {
            const missing = ((p.missingFields as string[]) ?? []).filter((k) => !(k in vars) || !vars[k]);
            return (
              <tr key={p.id}>
                <td><Link className="underline" href={`/admin/contenus/pages/${p.slug}`}>{p.title}</Link><span className="block font-mono text-xs text-stone-700">/{p.slug}</span></td>
                <td>{p.status === "PUBLISHED" ? <StatusBadge tone="ok">Publiée</StatusBadge> : <StatusBadge tone="warn">Brouillon</StatusBadge>}</td>
                <td className="text-xs">{missing.length ? missing.join(", ") : "—"}</td>
                <td>{fmtDate(p.updatedAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
