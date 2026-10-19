"use client";
import { useState, useTransition } from "react";
import { requestQuoteAction } from "@/server/actions/configurator";
import { Notice } from "@/components/ui/alert";

export function QuoteForm({ input, kind, configurationId, onDone, compact = false }: { input: unknown; kind: "configuration" | "custom" | "accessory" | "general"; configurationId: string | null; onDone?: (number: string) => void; compact?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const form = { firstName: fd.get("firstName"), lastName: fd.get("lastName"), email: fd.get("email"), phone: fd.get("phone") || undefined, postalCode: fd.get("postalCode") || undefined, message: fd.get("message") || undefined, consent: fd.get("consent") === "on" ? true : false };
    start(async () => {
      const r = await requestQuoteAction(input, form, kind, configurationId);
      if (r.ok) { setDone(r.data.number); onDone?.(r.data.number); } else setError(r.error);
    });
  };
  if (done) return <Notice tone="success">Demande {done} enregistrée. Vous recevez un e-mail de confirmation ; un conseiller vous répond sous 48 h ouvrées.</Notice>;
  return (
    <form onSubmit={submit} className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`} aria-label="Demande de devis">
      <div><label className="label" htmlFor="q-firstName">Prénom</label><input id="q-firstName" name="firstName" required className="input" autoComplete="given-name" /></div>
      <div><label className="label" htmlFor="q-lastName">Nom</label><input id="q-lastName" name="lastName" required className="input" autoComplete="family-name" /></div>
      <div><label className="label" htmlFor="q-email">E-mail</label><input id="q-email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="q-phone">Téléphone (facultatif)</label><input id="q-phone" name="phone" type="tel" className="input" autoComplete="tel" /></div>
      <div><label className="label" htmlFor="q-cp">Code postal du projet</label><input id="q-cp" name="postalCode" className="input" inputMode="numeric" autoComplete="postal-code" /></div>
      <div className={compact ? "" : "sm:col-span-2"}><label className="label" htmlFor="q-message">Votre projet, vos contraintes</label><textarea id="q-message" name="message" rows={3} className="input" /></div>
      <label className={`flex items-start gap-2 text-sm ${compact ? "" : "sm:col-span-2"}`}><input type="checkbox" name="consent" required className="mt-1" /> J'accepte que mes informations soient utilisées pour traiter ma demande de devis (voir la politique de confidentialité).</label>
      {error && <div className={compact ? "" : "sm:col-span-2"}><Notice tone="error">{error}</Notice></div>}
      <div className={compact ? "" : "sm:col-span-2"}><button className="btn-primary" type="submit" disabled={busy}>Envoyer la demande de devis</button></div>
    </form>
  );
}
