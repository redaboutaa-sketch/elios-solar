"use client";
import { useActionState, useRef } from "react";
import Link from "@/i18n/link";
import { useT } from "@/i18n/client";
import { readAttribution } from "@/components/analytics/attribution";
import { contactAction, type ContactState } from "@/server/actions/contact";
import { Notice } from "@/components/ui/alert";

export function ContactForm({ kind }: { kind: "contact" | "callback" }) {
  const t = useT("forms").form;
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, null);
  const attribution = useRef<HTMLInputElement>(null);
  // attribution de la session jointe au moment de l'envoi (aucune donnée lue avant l'action du visiteur)
  const attach = () => { const a = readAttribution(); if (attribution.current) attribution.current.value = a ? JSON.stringify(a) : ""; };
  if (state?.ok) return <Notice tone="success">{kind === "callback" ? t.successCallback : t.successContact}</Notice>;
  return (
    <form action={action} onSubmit={attach} className="card p-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <input ref={attribution} type="hidden" name="attribution" defaultValue="" />
      <div className="hidden" aria-hidden="true"><label htmlFor="website">{t.website}</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div><label className="label" htmlFor="name">{t.name}</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
      <div><label className="label" htmlFor="email">{t.email}</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="phone">{t.phone}{kind === "callback" ? "" : t.optional}</label><input id="phone" name="phone" type="tel" required={kind === "callback"} className="input" autoComplete="tel" /></div>
      {kind === "callback" ? <div><label className="label" htmlFor="preferredSlot">{t.slot}</label><select id="preferredSlot" name="preferredSlot" className="input"><option value="Matin (9h–12h)">{t.slotMorning}</option><option value="Après-midi (14h–18h)">{t.slotAfternoon}</option><option value="Début de soirée (18h–19h)">{t.slotEvening}</option></select></div> : <div className="sm:col-span-2"><label className="label" htmlFor="message">{t.message}</label><textarea id="message" name="message" rows={4} required className="input" /></div>}
      <label className="sm:col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1" /> <span>{t.consentBefore}<Link href="/confidentialite" className="underline" target="_blank">{t.consentLink}</Link>{t.consentAfter}</span></label>
      {state?.error && <div className="sm:col-span-2"><Notice tone="error">{state.error}</Notice></div>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{kind === "callback" ? t.submitCallback : t.submit}</button></div>
    </form>
  );
}
