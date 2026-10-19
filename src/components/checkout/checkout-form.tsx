"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { checkoutAction, type CheckoutState } from "@/server/actions/cart";
import { Notice } from "@/components/ui/alert";

type D = { email: string; firstName: string; lastName: string; line1: string; line2: string; postalCode: string; city: string; phone: string };

type Errs = Record<string, string> | undefined;

function Field({ name, label, auto, type = "text", required = true, defaultValue = "", errors }: { name: string; label: string; auto?: string; type?: string; required?: boolean; defaultValue?: string; errors: Errs }) {
  const err = errors?.[name];
  return (
    <div><label className="label" htmlFor={name}>{label}{!required && " (facultatif)"}</label><input id={name} name={name} type={type} autoComplete={auto} required={required} defaultValue={defaultValue} className="input" aria-invalid={!!err} aria-describedby={err ? `${name}-err` : undefined} />{err && <p id={`${name}-err`} className="text-xs text-danger mt-1">{err}</p>}</div>
  );
}

function AddressFields({ p, d, errors }: { p: string; d?: D; errors: Errs }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field name={`${p}.firstName`} label="Prénom" auto="given-name" defaultValue={d?.firstName} errors={errors} /><Field name={`${p}.lastName`} label="Nom" auto="family-name" defaultValue={d?.lastName} errors={errors} />
      <div className="sm:col-span-2"><Field name={`${p}.company`} label="Société" auto="organization" required={false} errors={errors} /></div>
      <div className="sm:col-span-2"><Field name={`${p}.line1`} label="Adresse" auto="address-line1" defaultValue={d?.line1} errors={errors} /></div>
      <div className="sm:col-span-2"><Field name={`${p}.line2`} label="Complément" auto="address-line2" required={false} defaultValue={d?.line2} errors={errors} /></div>
      <Field name={`${p}.postalCode`} label="Code postal" auto="postal-code" defaultValue={d?.postalCode} errors={errors} /><Field name={`${p}.city`} label="Ville" auto="address-level2" defaultValue={d?.city} errors={errors} />
      <input type="hidden" name={`${p}.countryCode`} value="FR" />
      <div className="sm:col-span-2"><Field name={`${p}.phone`} label="Téléphone (livraison sur rendez-vous)" auto="tel" type="tel" defaultValue={d?.phone} errors={errors} /></div>
    </div>
  );
}

export function CheckoutForm({ defaults, provider }: { defaults: D; provider: "DEMO" | "STRIPE" | "INSTALLMENTS_SIM" }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, null);
  const [billingSame, setBillingSame] = useState(true);
  const errors = state?.fieldErrors;
  return (
    <form action={action} className="space-y-8" aria-describedby={state?.error ? "checkout-error" : undefined}>
      <section className="card p-5"><h2 className="font-display text-xl mb-3">Contact</h2><Field name="email" label="E-mail" auto="email" type="email" defaultValue={defaults.email} errors={errors} /></section>
      <section className="card p-5"><h2 className="font-display text-xl mb-3">Adresse de livraison</h2><AddressFields p="shipping" d={defaults} errors={errors} /></section>
      <section className="card p-5">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="billingSame" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} /> Adresse de facturation identique</label>
        {!billingSame && <div className="mt-4"><h2 className="font-display text-xl mb-3">Adresse de facturation</h2><AddressFields p="billing" errors={errors} /></div>}
      </section>
      <section className="card p-5 space-y-3">
        <div><label className="label" htmlFor="customerNotes">Instructions de livraison (facultatif)</label><textarea id="customerNotes" name="customerNotes" rows={2} className="input" /></div>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="acceptCgv" required className="mt-1" /> J'ai lu et j'accepte les <Link href="/cgv" className="underline" target="_blank">conditions générales de vente</Link> et la <Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link>.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="marketingOptIn" className="mt-1" /> Je souhaite recevoir des informations commerciales (facultatif, distinct de la commande).</label>
      </section>
      {state?.error && <div id="checkout-error"><Notice tone="error">{state.error}</Notice></div>}
      <div className="card p-5">
        {provider === "DEMO" ? <Notice tone="warn">Mode test : aucun paiement réel. Vous serez dirigé vers une page de paiement simulé clairement identifiée.</Notice> : <p className="text-sm text-stone-700">Paiement sécurisé par carte via notre prestataire (page hébergée). Aucune donnée de carte n'est stockée sur ce site.</p>}
        <button type="submit" className="btn-accent w-full mt-4" disabled={pending}>{pending ? "Création de la commande…" : provider === "DEMO" ? "Continuer vers le paiement simulé" : "Procéder au paiement"}</button>
      </div>
    </form>
  );
}
