"use client";
import { useEffect, useState } from "react";
import { saveConsentAction } from "@/server/actions/consent";

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
          <p id="consent-title" className="font-medium">Cookies et mesure d'audience</p>
          <p className="text-stone-700">Seuls les cookies nécessaires sont actifs. {analyticsAvailable ? "La mesure d'audience et le marketing ne s'activent qu'avec votre accord." : "Aucun service de mesure d'audience ni de marketing n'est configuré pour le moment."}</p>
          {custom && (
            <div className="mt-2 flex flex-col gap-1">
              <label className="flex items-center gap-2"><input type="checkbox" checked disabled /> Nécessaires (toujours actifs)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.analytics} onChange={(e) => setPrefs({ ...prefs, analytics: e.target.checked })} disabled={!analyticsAvailable} /> Mesure d'audience</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={prefs.marketing} onChange={(e) => setPrefs({ ...prefs, marketing: e.target.checked })} /> Marketing</label>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={() => commit({ analytics: false, marketing: false })}>Tout refuser</button>
          {custom ? (
            <button type="button" className="btn-primary" onClick={() => commit(prefs)}>Enregistrer</button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setCustom(true)}>Personnaliser</button>
          )}
          <button type="button" className="btn-primary" onClick={() => commit({ analytics: analyticsAvailable, marketing: true })}>Tout accepter</button>
        </div>
      </div>
    </div>
  );
}

export function CookiePreferencesButton() {
  return (
    <button type="button" className="underline hover:text-ink" onClick={() => window.dispatchEvent(new CustomEvent("es:consent-open"))}>
      Gérer les cookies
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
