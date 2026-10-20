import Link from "next/link";

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-stone-700">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li><Link href="/" className="hover:underline">Accueil</Link></li>
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {it.href ? <Link href={it.href} className="hover:underline">{it.label}</Link> : <span aria-current="page" className="text-ink">{it.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
