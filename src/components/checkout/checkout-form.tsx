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

export interface InstallmentOfferView {
  providerLabel: string;
  simulated: boolean;
  termsUrl: string | null;
  plans: Array<{ count: number; firstCents: number; otherCents: number; feesCents: number; totalWithFeesCents: number; feesKind: "none_confirmed" | "fees" | "unconfirmed"; feesText: string }>;
}

const eur = (c: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(c / 100);

function PaymentMethodBlock({ offer, choice, setChoice, stripe, customerType }: { offer: InstallmentOfferView | null; choice: string; setChoice: (v: string) => void; stripe: boolean; customerType: "B2C" | "B2B" }) {
  return (
    <section className="card p-5" aria-labelledby="payment-method-title">
      <h2 id="payment-method-title" className="font-display text-xl mb-3">Moyen de paiement</h2>
      <fieldset className="space-y-3">
        <legend className="sr-only">Moyen de paiement</legend>
        <label className="flex items-start gap-2 text-sm"><input type="radio" name="paymentChoice" value="card" checked={choice === "card"} onChange={() => setChoice("card")} className="mt-1" /> <span><strong>Paiement en ligne en une fois</strong><span className="block text-stone-700">{stripe ? "Carte bancaire, et selon votre appareil et votre pays Apple Pay, Google Pay, PayPal ou Bancontact : la page de paiement n'affiche que les moyens réellement disponibles pour vous." : "Carte bancaire (simulée dans cette préproduction)."}</span></span></label>
        {stripe && <label className="flex items-start gap-2 text-sm"><input type="radio" name="paymentChoice" value="bank_transfer" checked={choice === "bank_transfer"} onChange={() => setChoice("bank_transfer")} className="mt-1" data-testid="pay-bank-transfer" /> <span><strong>Virement bancaire</strong><span className="block text-stone-700">Coordonnées bancaires remises sur la page de paiement ; la commande est confirmée à réception des fonds, pas avant.</span></span></label>}
        {customerType === "B2C" && offer?.plans.map((p) => (
          <label key={p.count} className="flex items-start gap-2 text-sm">
            <input type="radio" name="paymentChoice" value={`installments:${p.count}`} checked={choice === `installments:${p.count}`} onChange={() => setChoice(`installments:${p.count}`)} className="mt-1" />
            <span>
              <strong>Paiement en {p.count} fois via {offer.providerLabel}</strong>
              <span className="block text-stone-700" data-testid={`plan-${p.count}`}>1re échéance {eur(p.firstCents)}, puis {p.count - 1} × {eur(p.otherCents)} · {p.feesKind === "none_confirmed" ? p.feesText : p.feesKind === "fees" ? `${p.feesText} — total ${eur(p.totalWithFeesCents)}` : p.feesText}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {offer && offer.plans.length > 0 && (
        <p className="mt-3 text-xs text-stone-700">Paiement fractionné sous réserve d'acceptation par le prestataire.{offer.termsUrl && <> Voir les <a href={offer.termsUrl} target="_blank" rel="noopener noreferrer" className="underline">conditions du prestataire</a>.</>}{offer.simulated && " Mode test : simulateur, aucune transaction."}</p>
      )}
      {customerType === "B2B" && offer && offer.plans.length > 0 && <p className="mt-3 text-xs text-stone-700">Paiement en plusieurs fois réservé aux particuliers.</p>}
      <input type="hidden" name="paymentMethod" value={choice === "card" || choice === "bank_transfer" ? choice : "installments"} />
      <input type="hidden" name="installments" value={choice.startsWith("installments:") ? choice.split(":")[1] : ""} />
    </section>
  );
}

export function CheckoutForm({ defaults, provider, installmentOffer = null }: { defaults: D; provider: "DEMO" | "STRIPE" | "INSTALLMENTS_SIM"; installmentOffer?: InstallmentOfferView | null }) {
  const [state, action, pending] = useActionState<CheckoutState, FormData>(checkoutAction, null);
  const [billingSame, setBillingSame] = useState(true);
  const [choice, setChoice] = useState("card");
  const [customerType, setCustomerType] = useState<"B2C" | "B2B">("B2C");
  const installments = choice.startsWith("installments:");
  const errors = state?.fieldErrors;
  return (
    <form action={action} className="space-y-8" aria-describedby={state?.error ? "checkout-error" : undefined}>
      <section className="card p-5"><h2 className="font-display text-xl mb-3">Contact</h2><Field name="email" label="E-mail" auto="email" type="email" defaultValue={defaults.email} errors={errors} />
        <fieldset className="mt-3"><legend className="label">Vous commandez en tant que</legend><div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="customerType" value="B2C" checked={customerType === "B2C"} onChange={() => setCustomerType("B2C")} /> Particulier</label>
          <label className="flex items-center gap-2"><input type="radio" name="customerType" value="B2B" checked={customerType === "B2B"} onChange={() => { setCustomerType("B2B"); if (choice.startsWith("installments:")) setChoice("card"); }} /> Professionnel</label>
        </div></fieldset>
      </section>
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
      <PaymentMethodBlock offer={installmentOffer} choice={choice} setChoice={setChoice} stripe={provider === "STRIPE"} customerType={customerType} />
      {state?.error && <div id="checkout-error"><Notice tone="error">{state.error}</Notice></div>}
      <div className="card p-5">
        {choice === "bank_transfer" ? <p className="text-sm text-stone-700">Vous serez dirigé vers la page sécurisée du prestataire, qui affiche les coordonnées du virement. Une capture de virement ne vaut pas paiement : la commande est confirmée quand les fonds sont reçus.</p> : installments ? <p className="text-sm text-stone-700">Vous serez dirigé vers la page hébergée du prestataire de paiement fractionné{installmentOffer?.simulated ? " (simulateur clairement identifié, aucune transaction)" : ""}.</p> : provider === "DEMO" ? <Notice tone="warn">Mode test : aucun paiement réel. Vous serez dirigé vers une page de paiement simulé clairement identifiée.</Notice> : <p className="text-sm text-stone-700">Paiement sécurisé par carte via notre prestataire (page hébergée). Aucune donnée de carte n'est stockée sur ce site.</p>}
        <button type="submit" className="btn-accent w-full mt-4" disabled={pending}>{pending ? "Création de la commande…" : choice === "bank_transfer" ? "Continuer vers le virement" : installments ? "Continuer vers le paiement fractionné" : provider === "DEMO" ? "Continuer vers le paiement simulé" : "Procéder au paiement"}</button>
      </div>
    </form>
  );
}
