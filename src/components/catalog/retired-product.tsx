import Link from "@/i18n/link";
import type { RetiredFamily } from "@/server/catalog/systems";
import { categoryByKey } from "@/domain/categories";
import { getT } from "@/i18n/server";

/**
 * Page d'un ancien modèle retiré du catalogue : explication et choix d'une gamme actuelle. Une configuration enregistrée
 * sur l'ancien modèle reste consultable dans « Mes projets » ; elle n'est jamais convertie : on recommence sur une gamme.
 */
export async function RetiredProduct({ retired, from = "fiche" }: { retired: RetiredFamily; from?: "fiche" | "configurateur" }) {
  const cat = retired.category ? categoryByKey(retired.category) : undefined;
  const t = (await getT("catalog")).retired;
  const labels = (await getT("layout")).categories;
  return (
    <div className="container-x py-10" data-testid="retired-product">
      <p className="eyebrow">{cat ? labels[cat.key] : t.catalog}</p>
      <h1 className="mt-2 font-display text-display font-semibold">{t.title}</h1>
      <p className="mt-3 max-w-2xl text-stone-800 text-pretty">
        {from === "configurateur" ? t.fromConfig : t.fromPage}
        {t.body}
      </p>
      {retired.suggestions.length > 0 && (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {retired.suggestions.map((s) => (
            <li key={s.slug} className="card-link rounded-2xl border border-sand-200 bg-white p-5">
              <h2 className="font-display text-xl font-semibold"><Link href={s.href} className="stretched">{s.name}</Link></h2>
              <p className="mt-2 text-sm text-stone-700">{s.shortDescription}</p>
              <p className="relative z-10 mt-4 flex flex-wrap gap-3 text-sm"><Link href={s.href} className="link-brand">{t.viewPage}</Link><Link href={s.configHref} className="link-brand">{t.configure}</Link></p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-sm text-stone-700">{t.helpBefore}<Link href="/contact" className="underline">{t.askAdvice}</Link>{t.or}<Link href="/compte/projets" className="underline">{t.findProjects}</Link>{t.helpAfter}</p>
    </div>
  );
}
