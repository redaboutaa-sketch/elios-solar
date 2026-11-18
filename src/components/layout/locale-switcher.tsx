"use client";
/**
 * Sélecteur de langue discret (bandeau) : libellés dans leur langue, clavier (Entrée / Espace pour ouvrir, flèches,
 * Échap pour fermer et rendre le focus), page équivalente et paramètres conservés (le projet en cours est gardé :
 * brouillon local par modèle, indépendant de la langue). Aucune redirection automatique (ni adresse IP, ni navigateur).
 * Masqué quand une seule langue est servie.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { localizePath, splitLocale, type Locale } from "@/i18n/config";
import { fmt } from "@/i18n/format";
import { useBarePathname, useI18n, useT } from "@/i18n/client";

export function LocaleSwitcher({ className = "relative" }: { className?: string } = {}) {
  const i18n = useI18n();
  const t = useT("layout");
  const [open, setOpen] = useState(false);
  const [suffix, setSuffix] = useState({ path: "/", rest: "" });
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>("[aria-current='true'], a")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    const onDown = (e: MouseEvent) => { if (!list.current?.parentElement?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [open]);
  if (!i18n || i18n.enabled.length < 2) return null;
  const current = i18n.enabled.find((l) => l.code === i18n.locale)!;
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>("a") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };
  return (
    <div className={className}>
      <button ref={button} type="button" className="btn min-h-11 gap-1 px-2 text-xs font-semibold uppercase text-sand-50 hover:bg-white/10" aria-expanded={open} aria-controls={id} aria-label={fmt(t.language.button, { language: current.label })} onClick={() => {
        // page équivalente : chemin sans préfixe, paramètres (projet, ligne, étape) et ancre conservés
        setSuffix({ path: splitLocale(window.location.pathname).path, rest: `${window.location.search}${window.location.hash}` });
        setOpen((o) => !o);
      }} data-testid="locale-switcher">
        <Globe className="size-4" aria-hidden="true" /><span aria-hidden="true">{current.code}</span>
      </button>
      {open && (
        <ul ref={list} id={id} aria-label={t.language.menu} onKeyDown={onListKey} className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-[3px] border border-sand-200 bg-white py-1 text-sm text-ink shadow-soft" data-testid="locale-menu">
          {i18n.enabled.map((l) => (
            <li key={l.code}>
              <a href={`${localizePath(suffix.path, l.code as Locale)}${suffix.rest}`} hrefLang={l.htmlLang} lang={l.htmlLang} aria-current={l.code === i18n.locale ? "true" : undefined} className="flex min-h-11 items-center justify-between gap-3 px-3 hover:bg-sand-100 focus-visible:bg-sand-100 aria-[current=true]:font-semibold" data-locale={l.code}>
                {l.label}<span className="text-xs uppercase text-stone-700">{l.code}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Bandeau des traductions non publiées : version en préparation, aucune confirmation de livraison dans le pays. */
/** Liste des langues dans le menu mobile (sous 1024 px, le bandeau laisse la place au logo centré). */
export function LocaleLinks() {
  const i18n = useI18n();
  const path = useBarePathname();
  const t = useT("layout");
  if (!i18n || i18n.enabled.length < 2) return null;
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label={t.language.menu} data-testid="locale-links">
      {i18n.enabled.map((l) => (
        <li key={l.code}><a href={localizePath(path, l.code as Locale)} onClick={(e) => { e.currentTarget.href = `${localizePath(path, l.code as Locale)}${window.location.search}`; }} hrefLang={l.htmlLang} lang={l.htmlLang} aria-current={l.code === i18n.locale ? "true" : undefined} className="inline-flex min-h-11 items-center rounded-[3px] border border-sand-300 px-3 text-sm aria-[current=true]:border-anthracite aria-[current=true]:font-semibold">{l.label}</a></li>
      ))}
    </ul>
  );
}

export function PreviewLocaleBanner() {
  const t = useT("layout");
  const path = useBarePathname();
  return (
    <div role="note" className="border-b border-amber-300 bg-amber-50 text-ink" data-testid="locale-preview">
      <div className="container-x py-2 text-xs sm:text-sm">
        <strong>{t.preview.title}.</strong> {t.preview.body} <a href={path} onClick={(e) => { e.currentTarget.href = `${path}${window.location.search}${window.location.hash}`; }} hrefLang="fr" lang="fr" className="underline">{t.preview.frenchSite}</a>
      </div>
    </div>
  );
}
