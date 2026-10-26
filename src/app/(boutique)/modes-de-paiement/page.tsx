import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { METHOD_STATE_FR, paymentMethods } from "@/server/payment/methods";

export const metadata: Metadata = { title: "Modes de paiement", description: "Moyens de paiement disponibles ou envisagés chez HELIOSTORES.", alternates: { canonical: "/modes-de-paiement" } };

export default async function PaymentMethodsPage() {
  const methods = await paymentMethods();
  return (
    <div className="container-x py-10">
      <Breadcrumbs items={[{ label: "Modes de paiement" }]} />
      <h1 className="mt-5 font-display text-display font-semibold">Modes de paiement</h1>
      <p className="mt-3 max-w-2xl text-stone-800">Seuls les moyens marqués « disponible » peuvent être utilisés. Les autres sont envisagés : leurs conditions seront précisées lors de leur ouverture.</p>
      <ul className="mt-8 grid gap-px overflow-hidden border border-sand-200 bg-sand-200 md:grid-cols-2" data-testid="payment-methods">
        {methods.map((m) => (
          <li key={m.code} className="bg-white p-6" data-state={m.state}>
            <h2 className="font-display text-xl font-semibold">{m.label}</h2>
            <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${m.state === "active" ? "text-success" : m.state === "simulated" ? "text-brand-700" : "text-stone-700"}`}>{METHOD_STATE_FR[m.state]}</p>
            <p className="mt-2 text-sm text-stone-800">{m.text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-stone-700">Un projet avec options, pose ou livraison se règle selon les modalités de votre <Link className="underline" href="/devis">devis</Link>.</p>
    </div>
  );
}
