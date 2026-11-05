import type { InstallGuide } from "@/server/content/install-guides";

/**
 * Affichage d'un guide d'accompagnement : sommaire, sections, étapes numérotées avec la page de la notice officielle,
 * avertissements cités. Les visuels sont illustratifs ; seule la notice officielle fait foi.
 */
export function GuideView({ guide, media }: { guide: InstallGuide; media: Map<string, { path: string; alt: string }> }) {
  return (
    <article className="max-w-3xl" data-testid="install-guide">
      <p role="note" className="rounded-md border border-brand-700/30 bg-brand-50 px-4 py-3 text-sm text-ink">
        <strong>Guide d'accompagnement HELIOSTORES, pas une notice officielle.</strong> Il résume la notice du fabricant et renvoie à ses pages. La notice officielle fait foi : elle est remise avec le produit et doit être lue en entier avant toute intervention.
      </p>
      <nav aria-label="Sommaire" className="mt-6 rounded-md border border-sand-200 bg-white p-4">
        <p className="text-sm font-semibold">Sommaire</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{guide.sections.map((s) => <li key={s.id}><a className="underline" href={`#${s.id}`}>{s.title}</a></li>)}<li><a className="underline" href="#notices">Notices officielles</a></li></ol>
      </nav>
      {guide.sections.map((s, si) => (
        <section key={s.id} id={s.id} className="mt-10 scroll-mt-24" aria-labelledby={`${s.id}-t`}>
          <h2 id={`${s.id}-t`} className="font-display text-2xl font-semibold">{si + 1}. {s.title}</h2>
          {s.intro && <p className="mt-2 text-stone-800">{s.intro}</p>}
          {s.media?.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {s.media.map((m) => { const x = media.get(m.key); return x ? <figure key={m.key} className="border border-sand-200 bg-white p-2">{/* eslint-disable-next-line @next/next/no-img-element -- visuel de la médiathèque, taille d'origine */}<img src={x.path} alt={x.alt} className="h-auto w-full" loading="lazy" /><figcaption className="mt-1 text-xs text-stone-700">{m.caption}</figcaption></figure> : null; })}
            </div>
          ) : null}
          {s.steps?.length ? (
            <ol className="mt-4 space-y-3">{s.steps.map((st, i) => <li key={i} className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-700 text-sm font-semibold text-white" aria-hidden="true">{i + 1}</span><p className="text-stone-800">{st.text} <span className="whitespace-nowrap text-xs text-stone-700">(notice, {st.page})</span></p></li>)}</ol>
          ) : null}
          {s.items?.length ? <ul className="mt-4 list-disc space-y-1 pl-5 text-stone-800">{s.items.map((it) => <li key={it}>{it}</li>)}</ul> : null}
          {s.warnings?.length ? (
            <div className="mt-4 space-y-2">{s.warnings.map((w, i) => <p key={i} className="rounded-md border-l-4 border-warning bg-warning/10 px-3 py-2 text-sm text-ink"><span className="font-semibold">Avertissement</span> — {w.text} <span className="text-xs text-stone-700">({w.page})</span></p>)}</div>
          ) : null}
        </section>
      ))}
      <section id="notices" className="mt-10 scroll-mt-24" aria-labelledby="notices-t">
        <h2 id="notices-t" className="font-display text-2xl font-semibold">Notices officielles</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-stone-800">{guide.officialDocs.map((d) => <li key={d.title}>{d.title}{d.pages ? ` (${d.pages})` : ""}{d.note ? ` — ${d.note}` : ""}</li>)}</ul>
        <p className="mt-2 text-sm text-stone-700">Remises avec le produit ; disponibles sur demande auprès d'un conseiller.</p>
      </section>
    </article>
  );
}
