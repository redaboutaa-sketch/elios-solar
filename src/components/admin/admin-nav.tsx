"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV, type NavItem } from "./nav-items";

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Item({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} aria-current={active ? "page" : undefined} className={`block rounded-md px-3 py-1.5 text-sm ${active ? "bg-anthracite text-sand-50" : "text-stone-800 hover:bg-sand-200"}`}>
      {item.label}
    </Link>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {ADMIN_NAV.map((item) =>
        item.children ? (
          <li key={item.label} className="pt-2">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-stone-700">{item.label}</p>
            <ul className="space-y-0.5 border-l border-sand-300 ml-3 pl-1">
              {item.children.map((c) => <li key={c.href}><Item item={c} pathname={pathname} /></li>)}
            </ul>
          </li>
        ) : (
          <li key={item.href}><Item item={item} pathname={pathname} /></li>
        ),
      )}
    </ul>
  );
}

/** Menu mobile : simple liste dépliable, refermée après navigation. */
export function AdminMobileNav() {
  const pathname = usePathname();
  return (
    <details key={pathname} className="lg:hidden border-b border-sand-200 bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Menu de l'administration</summary>
      <nav aria-label="Administration (mobile)" className="px-3 pb-3"><AdminNav /></nav>
    </details>
  );
}
