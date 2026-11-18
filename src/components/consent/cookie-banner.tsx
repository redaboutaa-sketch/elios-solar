"use client";
import { useEffect, useState } from "react";
import { saveConsentAction } from "@/server/actions/consent";
import { useT } from "@/i18n/client";

/** Aucun traceur publicitaire ni service marketing n'est intégré : la catégorie reste refusée tant qu'il n'en existe pas. */
const MARKETING_AVAILABLE = false;

export const CONSENT_VERSION = "2026-10";
const KEY = "es_consent_v";

type Prefs = { analytics: boolean; marketing: boolean };

function read(): { version: string; prefs: Prefs } | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as { version: string; prefs: Prefs }) : null;
  } catch { return null; }
}

function write(prefs: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify({ version: CONSENT_VERSION, prefs })); } catch { /* stockage indisponible */ }
  window.dispatchEvent(new CustomEvent("es:consent", { detail: prefs }));
}

export function CookieBanner({ analyticsAvailable }: { analyticsAvailable: boolean }) {
  const t = useT("layout").consent;
  const [visible, setVisible] = useState(false);
  const [custom, setCustom] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ analytics: false, marketing: false });
  useEffect(() => {
    const t = setTimeout(() => { const stored = read(); if (!stored || stored.version !== CONSENT_VERSION) setVisible(true); }, 0);
    const onOpen = () => { setCustom(true); setVisible(true); };
    window.addEventListener("es:consent-open", onOpen);
    return () => { clearTimeout(t); window.removeEventListener("es:consent-open", onOpen); };
  }, []);
  if (!visible) return null;
  const commit = async (p: Prefs) => {
    write(p);
    setVisible(false);
    await saveConsentAction({ ...p, version: CONSENT_VERSION });
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-300 bg-white shadow-soft">
      <div className="container-x py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm">
          <p id="consent-title" className="font-medium">{t.title}</p>
          <p className="text-stone-700">{t.intro} {analyticsAvailable ? t.withAnalytics : t.noAnalytics}</p>
          {custom && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> {t.necessary}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.analytics} onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })} disabled={!analyticsAvailable} /> {t.analytics}</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.marketing} onChange={(e) => setPrefs({ ...prefs, marketing: e.target.checked })} disabled={!MARKETING_AVAILABLE} /> {t.marketing}{MARKETING_AVAILABLE ? "" : t.noService}</label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => commit({ analytics: false, marketing: false })}>{t.refuse}</button>
          {custom ? (
            <button type="button" className="btn-primary" onClick={() => commit(prefs)}>{t.save}</button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setCustom(true)}>{t.customize}</button>
          )}
          <button type="button" className="btn-primary" onClick={() => commit({ analytics: analyticsAvailable, marketing: MARKETING_AVAILABLE })}>{t.accept}</button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencesButton() {
  const t = useT("layout").consent;
  return (
    <button type="button" className="underline hover:text-ink" onClick={() => window.dispatchEvent(new CustomEvent("es:consent-open"))}>
      {t.manage}
    </button>
  );
}

/** Charge le script de mesure d'audience uniquement si le consentement est donné. */
export function ConsentGatedScript({ src }: { src: string | null }) {
  useEffect(() => {
    if (!src) return;
    const load = (p: Prefs) => {
      if (!p.analytics || document.querySelector(`script[data-consent-src="${src}"]`)) return;
      const s = document.createElement("script");
      s.src = src; s.async = true; s.dataset.consentSrc = src;
      document.head.appendChild(s);
    };
    const stored = read();
    if (stored?.version === CONSENT_VERSION) load(stored.prefs);
    const handler = (e: Event) => load((e as CustomEvent<Prefs>).detail);
    window.addEventListener("es:consent", handler);
    return () => window.removeEventListener("es:consent", handler);
  }, [src]);
  return null;
}
