import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { INSTALL_GUIDES } from "@/server/content/install-guides";
import { GUIDE_STATUS_FR, guideStatuses } from "@/server/guides/status";

export const metadata: Metadata = { title: "Guides d'installation" };

export default async function GuidesAdmin(props: PageProps<"/admin/guides">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const st = await guideStatuses();
  return (
    <div className="space-y-6">
      <PageTitle title="Guides d'installation" />
      <Flash searchParams={props.searchParams} />
      <Section>
        <p className="mb-3 text-sm text-stone-700">Synthèses HELIOSTORES des notices officielles. Brouillon tant qu'aucune validation technique n'est enregistrée ; seul un guide publié est visible du public. Les notices officielles restent la référence.</p>
        <Table caption="Guides">
          <thead><tr><th>Guide</th><th>Statut</th><th>Validation</th><th>Manque</th></tr></thead>
          <tbody>{INSTALL_GUIDES.map((g) => { const s = st.get(g.slug)!; return <tr key={g.slug}><td><Link className="underline" href={`/admin/guides/${g.slug}`}>{g.title}</Link></td><td><StatusBadge tone={s.status === "PUBLISHED" ? "ok" : s.status === "VALIDATED" ? "neutral" : "warn"}>{GUIDE_STATUS_FR[s.status]}</StatusBadge></td><td className="text-xs">{s.validatedBy ? `${s.validatedBy}, ${fmtDate(s.validatedAt)}` : "—"}</td><td className="text-xs">{g.missing.length} point(s)</td></tr>; })}</tbody>
        </Table>
      </Section>
    </div>
  );
}
