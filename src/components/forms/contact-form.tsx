"use client";
import { useActionState, useRef } from "react";
import Link from "next/link";
import { readAttribution } from "@/components/analytics/attribution";
import { contactAction, type ContactState } from "@/server/actions/contact";
import { Notice } from "@/components/ui/alert";

export function ContactForm({ kind }: { kind: "contact" | "callback" }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(contactAction, null);
  const attribution = useRef<HTMLInputElement>(null);
  // attribution de la session jointe au moment de l'envoi (aucune donnée lue avant l'action du visiteur)
  const attach = () => { const a = readAttribution(); if (attribution.current) attribution.current.value = a ? JSON.stringify(a) : ""; };
  if (state?.ok) return <Notice tone="success">{kind === "callback" ? "Demande de rappel enregistrée : un conseiller vous rappelle en tenant compte du créneau souhaité." : "Message enregistré : un conseiller vous répond."}</Notice>;
  return (
    <form action={action} onSubmit={attach} className="card p-6 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <input ref={attribution} type="hidden" name="attribution" defaultValue="" />
      <div className="hidden" aria-hidden="true"><label htmlFor="website">Site web</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
      <div><label className="label" htmlFor="name">Nom</label><input id="name" name="name" required className="input" autoComplete="name" /></div>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className="input" autoComplete="email" /></div>
      <div><label className="label" htmlFor="phone">Téléphone{kind === "callback" ? "" : " (facultatif)"}</label><input id="phone" name="phone" type="tel" required={kind === "callback"} className="input" autoComplete="tel" /></div>
      {kind === "callback" ? <div><label className="label" htmlFor="preferredSlot">Créneau souhaité</label><select id="preferredSlot" name="preferredSlot" className="input"><option>Matin (9h–12h)</option><option>Après-midi (14h–18h)</option><option>Début de soirée (18h–19h)</option></select></div> : <div className="sm:col-span-2"><label className="label" htmlFor="message">Message</label><textarea id="message" name="message" rows={4} required className="input" /></div>}
      <label className="sm:col-span-2 flex items-start gap-2 text-sm"><input type="checkbox" name="consent" required className="mt-1" /> <span>J'accepte que mes informations soient utilisées pour répondre à ma demande (voir la <Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link>).</span></label>
      {state?.error && <div className="sm:col-span-2"><Notice tone="error">{state.error}</Notice></div>}
      <div className="sm:col-span-2"><button className="btn-primary" disabled={pending}>{kind === "callback" ? "Être rappelé" : "Envoyer"}</button></div>
    </form>
  );
}
