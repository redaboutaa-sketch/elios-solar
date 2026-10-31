"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { DELIVERY_LEAD_TIME } from "@/domain/delivery";
import { requestQuoteAction } from "@/server/actions/configurator";
import { Notice } from "@/components/ui/alert";
import { readAttribution } from "@/components/analytics/attribution";

const VISUAL_TIMEOUT_MS = 10_000;

const VISUAL_DONE: Record<string, string> = {
  SCENE_3D: "La visualisation de votre projet est jointe au devis (non contractuelle).",
  PLAN_2D: "La vue 3D n'a pas pu être jointe : un plan 2D de votre configuration est joint au devis.",
  NONE: "Aucune visualisation n'a pu être jointe : le devis reste établi sur la base de votre configuration.",
};

/** Obtient la visualisation sans jamais bloquer la demande de devis (délai maximal, erreurs ignorées). */
async function visualOrNull(getVisual?: () => Promise<string | null>): Promise<string | null> {
  if (!getVisual) return null;
  try {
    return await Promise.race([getVisual(), new Promise<null>((resolve) => setTimeout(() => resolve(null), VISUAL_TIMEOUT_MS))]);
  } catch {
    return null;
  }
}

/** Recours direct après l'enregistrement : e-mail de contact public (Réglages), en citant la référence de la demande. */
function ContactAlternatives({ contact, number }: { contact: { email: string | null }; number: string }) {
  if (!contact.email) return null;
  return (
    <span data-testid="quote-contact" className="block mt-1">
      Pour compléter votre demande, écrivez-nous en rappelant la référence {number} : <a href={`mailto:${contact.email}?subject=${encodeURIComponent(`Demande ${number}`)}`} className="underline">{contact.email}</a>.
    </span>
  );
}

export function QuoteForm({ input, kind, configurationId, onDone, compact = false, getVisual }: { input: unknown; kind: "configuration" | "custom" | "accessory" | "general" | "system"; configurationId: string | null; onDone?: (number: string, visualNote?: string) => void; compact?: boolean; /** visualisation à joindre (dataURL), voir useQuoteVisual */ getVisual?: () => Promise<string | null> }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ number: string; visual: string; mailed: boolean; contact: { email: string | null } } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = { firstName: fd.get("firstName"), lastName: fd.get("lastName"), email: fd.get("email"), phone: fd.get("phone") || undefined, postalCode: fd.get("postalCode") || undefined, message: fd.get("message") || undefined, consent: fd.get("consent") === "on" ? true : false };
    start(async () => {
      setPreparing(!!getVisual);
      const visual = await visualOrNull(getVisual);
      setPreparing(false);
      const r = await requestQuoteAction(input, form, kind, configurationId, visual, readAttribution());
      if (r.ok) { setDone({ number: r.data.number, visual: r.data.visual, mailed: r.data.mailed, contact: r.data.contact }); onDone?.(r.data.number, getVisual ? VISUAL_DONE[r.data.visual] ?? VISUAL_DONE.NONE : undefined); } else setError(r.error);
    });
  };
  if (done) return <Notice tone="success"><span data-testid="quote-done">Demande {done.number} enregistrée : un conseiller l'étudie et vous recontacte.{done.mailed ? " Un e-mail récapitulatif vous est envoyé." : " Notez ce numéro : il identifie votre demande."}</span>{getVisual && <span data-testid="quote-visual-status" className="block mt-1">{VISUAL_DONE[done.visual] ?? VISUAL_DONE.NONE}</span>}{kind === "system" && <span data-testid="quote-delivery-lead-time" className="block mt-1">{DELIVERY_LEAD_TIME} Les modalités précises figureront dans votre devis.</span>}<ContactAlternatives contact={done.contact} number={done.number} /></Notice>;
  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`} aria-label="Demande de devis">
      <div><label className="label" htmlFor="q-firstName">Prénom</label><input id="q-firstName" name="firstName" required className="input" autoComplete="given-name" /></div>
      <div><label className="label" htmlFor="q-lastName">Nom</label><input id="q-lastName" name="lastName" required className="input" autoComplete="family-name" /></div>
      <div><label className="label" htmlFor="q-email">E-mail</label><input id="q-email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="q-phone">Téléphone (facultatif)</label><input id="q-phone" name="phone" type="tel" className="input" autoComplete="tel" /></div>
      <div><label className="label" htmlFor="q-cp">Code postal du projet</label><input id="q-cp" name="postalCode" className="input" inputMode="numeric" autoComplete="postal-code" /></div>
      <div className={compact ? "" : "sm:col-span-2"}><label className="label" htmlFor="q-message">Votre projet, vos contraintes</label><textarea id="q-message" name="message" rows={3} className="input" /></div>
      <label className={`flex items-start gap-2 text-sm ${compact ? "" : "sm:col-span-2"}`}><input type="checkbox" name="consent" required className="mt-1" /> <span>J'accepte que mes informations soient utilisées pour traiter ma demande de devis (voir la <Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link>).</span></label>
      {error && <div className={compact ? "" : "sm:col-span-2"}><Notice tone="error">{error}</Notice></div>}
      <div className={compact ? "" : "sm:col-span-2"}><button className="btn-primary" type="submit" disabled={busy}>{preparing ? "Préparation de la visualisation…" : "Envoyer la demande de devis"}</button></div>
    </form>
  );
}
