import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, fmtDate } from "@/components/admin/ui";
import { GuideView } from "@/components/guides/guide-view";
import { installGuide } from "@/server/content/install-guides";
import { GUIDE_STATUS_FR, guideMedia, guideStatuses } from "@/server/guides/status";
import { setGuideStatusAction } from "@/server/actions/admin/guides";

export const metadata: Metadata = { title: "Guide d'installation" };

export default async function GuideAdmin(props: PageProps<"/admin/guides/[slug]">) {
  const { role } = await requireRole(["ADMIN", "MANAGER"]);
  const { slug } = await props.params;
  const g = installGuide(slug);
  if (!g) notFound();
  const s = (await guideStatuses()).get(slug)!;
  const media = await guideMedia(g.sections.flatMap((x) => x.media?.map((m) => m.key) ?? []));
  return (
    <div className="space-y-6">
      <PageTitle title={g.title} backHref="/admin/guides" backLabel="Guides d'installation" />
      <Flash searchParams={props.searchParams} />
      <Section title="Statut">
        <p className="text-sm"><StatusBadge tone={s.status === "PUBLISHED" ? "ok" : s.status === "VALIDATED" ? "neutral" : "warn"}>{GUIDE_STATUS_FR[s.status]}</StatusBadge> {s.validatedBy ? `— validé par ${s.validatedBy} le ${fmtDate(s.validatedAt)}${s.note ? ` : ${s.note}` : ""}` : ""}</p>
        <p className="mt-2 text-sm"><a className="underline" href={`/api/guides/${g.slug}/pdf`} target="_blank" rel="noopener">Aperçu PDF</a></p>
        {g.missing.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-stone-800" data-testid="guide-missing">{g.missing.map((m) => <li key={m}>{m}</li>)}</ul>}
        {role === "ADMIN" && (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <form action={setGuideStatusAction} className="flex flex-wrap items-end gap-2 text-sm">
              <input type="hidden" name="slug" value={g.slug} /><input type="hidden" name="status" value="VALIDATED" />
              <label className="flex flex-col">Vérifié contre la notice par (nom, fonction)<input name="validator" className="input min-h-0 py-1" required minLength={3} /></label>
              <label className="flex flex-col">Note<input name="note" className="input min-h-0 py-1" /></label>
              <button className="btn-secondary" type="submit">Enregistrer la validation technique</button>
            </form>
            {s.status === "VALIDATED" && <form action={setGuideStatusAction}><input type="hidden" name="slug" value={g.slug} /><input type="hidden" name="status" value="PUBLISHED" /><button className="btn-primary" type="submit">Publier</button></form>}
            {s.status !== "DRAFT" && <form action={setGuideStatusAction}><input type="hidden" name="slug" value={g.slug} /><input type="hidden" name="status" value="DRAFT" /><button className="btn-ghost" type="submit">Repasser en brouillon</button></form>}
          </div>
        )}
      </Section>
      <Section title="Aperçu"><GuideView guide={g} media={media} /></Section>
    </div>
  );
}
