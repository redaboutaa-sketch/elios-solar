import Link from "next/link";

/** Fil d'Ariane discret. `tone="light"` : sur photographie (bandeaux de famille). */
export function Breadcrumbs({ items, tone = "default" }: { items: Array<{ href?: string; label: string }>; tone?: "default" | "light" }) {
  const light = tone === "light";
  return (
    <nav aria-label="Fil d'Ariane" className={`text-sm ${light ? "text-sand-200" : "text-stone-700"}`}>
      <ol className="flex flex-wrap items-center gap-1.5">
        <li><Link href="/" className="hover:underline">Accueil</Link></li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {it.href ? <Link href={it.href} className="hover:underline">{it.label}</Link> : <span aria-current="page" className={light ? "text-white" : "text-ink"}>{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
