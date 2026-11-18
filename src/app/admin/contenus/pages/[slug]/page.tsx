import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { contentVars, missingSettings } from "@/server/admin/launch";
import { renderMarkdown } from "@/server/content/render";
import { Notice } from "@/components/ui/alert";
import { Flash, PageTitle, Section } from "@/components/admin/ui";
import { updateContentPageAction } from "@/server/actions/admin/content";

export const metadata: Metadata = { title: "Édition de page" };

export default async function ContentPageEdit(props: PageProps<"/admin/contenus/pages/[slug]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { slug } = await props.params;
  const [page, settings] = await Promise.all([prisma.contentPage.findUnique({ where: { slug } }), prisma.siteSettings.findUnique({ where: { id: 1 } })]);
  if (!page) notFound();
  const vars = contentVars(settings);
  const declared = (page.missingFields as string[]) ?? [];
  const fromSettings = declared.filter((k) => k in vars);
  const manual = declared.filter((k) => !(k in vars));
  const emptySettings = missingSettings(settings);
  const placeholders = [...new Set([...page.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!))];
  const unresolved = placeholders.filter((k) => !vars[k]);
  return (
    <div className="space-y-6">
      <PageTitle title={page.title} backHref="/admin/contenus/pages" backLabel="Pages">
        <Link href={`/${page.slug}`} className="text-sm underline">Voir la page publique</Link>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Contenu">
          <form action={updateContentPageAction} className="space-y-4">
            <input type="hidden" name="slug" value={page.slug} />
            <div><label className="label" htmlFor="title">Titre</label><input id="title" name="title" required maxLength={160} className="input" defaultValue={page.title} /></div>
            <div>
              <label className="label" htmlFor="body">Texte (markdown : ## titre, - liste, **gras**, [lien](/chemin), {"{{variable}}"})</label>
              <textarea id="body" name="body" rows={22} className="input font-mono text-sm" defaultValue={page.body} />
            </div>
            <div><label className="label" htmlFor="missingFields">Champs manquants déclarés (séparés par des virgules)</label><input id="missingFields" name="missingFields" className="input font-mono text-sm" defaultValue={declared.join(", ")} /></div>
            <div><label className="label" htmlFor="status">Statut</label><select id="status" name="status" className="input" defaultValue={page.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"}><option value="DRAFT">Brouillon</option><option value="PUBLISHED">Publiée</option></select></div>
            {unresolved.length > 0 && <Notice tone="warn">Variables non résolues dans le texte : {unresolved.join(", ")}. Elles s'afficheront « à renseigner ».</Notice>}
            <button className="btn-primary" type="submit">Enregistrer</button>
          </form>
        </Section>
        <div className="space-y-6">
          <Section title="Champs manquants">
            {declared.length === 0 ? <p className="text-sm text-stone-700">Aucun champ déclaré.</p> : (
              <ul className="space-y-1 text-sm">
                {fromSettings.map((k) => <li key={k}><span className="font-mono">{k}</span> — {vars[k] ? <span className="text-success">renseigné dans les réglages</span> : <Link href="/admin/reglages" className="text-danger underline">vide dans les réglages</Link>}</li>)}
                {manual.map((k) => <li key={k}><span className="font-mono">{k}</span> — <span className="text-warning">à compléter dans le texte</span></li>)}
              </ul>
            )}
          </Section>
          <Section title="Réglages du site encore vides">
            {emptySettings.length === 0 ? <p className="text-sm text-success">Tous les champs obligatoires sont renseignés.</p> : <ul className="list-disc pl-5 text-sm">{emptySettings.map((m) => <li key={m.key}>{m.label} <span className="font-mono text-xs text-stone-700">({m.key})</span></li>)}</ul>}
            <Link href="/admin/reglages" className="mt-2 inline-block text-sm underline">Ouvrir les réglages</Link>
          </Section>
          <Section title="Aperçu">
            <div className="prose-shop text-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body, vars) }} />
          </Section>
        </div>
      </div>
    </div>
  );
}
