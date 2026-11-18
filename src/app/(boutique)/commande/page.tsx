import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { evaluateCart, findActiveCart, SYSTEM_DELIVERY_LABEL } from "@/server/cart/service";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { activeProviderName } from "@/server/payment";
import { installmentsOfferFor } from "@/server/payment/installments";
import { prisma } from "@/lib/prisma";
import { onlineSalesEnabled } from "@/server/payment/mode";

export const metadata: Metadata = { title: "Commande", robots: { index: false } };

export default async function CheckoutPage(props: PageProps<"/commande">) {
  if (!onlineSalesEnabled()) redirect("/panier");
  const sp = await props.searchParams;
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const cart = await findActiveCart({ userId: session?.user.id, guestKey });
  if (!cart || cart.lines.length === 0) redirect("/panier");
  const ev = await evaluateCart(cart);
  if (!ev.purchasable) redirect("/panier");
  const address = session ? await prisma.address.findFirst({ where: { userId: session.user.id }, orderBy: { isDefault: "desc" } }) : null;
  const provider = activeProviderName();
  // Offre de paiement fractionné calculée côté serveur sur le total du panier ; revalidée à la commande.
  // affichage pour un particulier (le choix « professionnel » masque l'offre) ; revalidé avec le type déclaré à la commande
  const offer = await installmentsOfferFor(ev.totalCents, ev.delivery.countryCode ?? "FR", undefined, "B2C");
  const installmentOffer = offer.eligible ? { providerLabel: offer.providerLabel, simulated: offer.provider.key === "simulator", termsUrl: offer.termsUrl, plans: offer.plans.map((p) => ({ count: p.count, firstCents: p.firstCents, otherCents: p.otherCents, feesCents: p.feesCents, totalWithFeesCents: p.totalWithFeesCents, feesKind: p.feesKind, feesText: p.label.split(" — ").slice(1).join(" — ") })) } : null;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ href: "/panier", label: "Panier" }, { label: "Commande" }]} />
      <h1 className="mt-4 font-display text-4xl">Finaliser la commande</h1>
      {!session && <p className="mt-2 text-sm text-stone-700">Vous commandez en tant qu'invité. <Link href="/compte/connexion?next=/commande" className="underline">Se connecter</Link> pour retrouver vos commandes et projets.</p>}
      {sp.repli === "carte" && <p className="mt-4 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm text-warning" role="status">Le paiement fractionné n'a pas abouti : votre panier est conservé, vous pouvez régler par carte en une fois.</p>}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <CheckoutForm defaults={{ email: session?.user.email ?? "", firstName: address?.firstName ?? session?.user.name.split(" ")[0] ?? "", lastName: address?.lastName ?? "", line1: address?.line1 ?? "", line2: address?.line2 ?? "", postalCode: address?.postalCode ?? ev.delivery.postalCode ?? "", city: address?.city ?? "", phone: address?.phone ?? "" }} provider={provider} installmentOffer={installmentOffer} />
        <aside className="card p-6 self-start lg:sticky lg:top-24">
          <h2 className="font-display text-2xl">Votre commande</h2>
          <ul className="mt-3 text-sm space-y-2">{ev.lines.map((l) => <li key={l.line.id} className="flex justify-between gap-2"><span>{l.result.lines[0]?.label}{l.line.qty > 1 && ` × ${l.line.qty}`}</span><Price cents={l.lineTotalCents} /></li>)}</ul>
          <dl className="mt-4 border-t border-sand-200 pt-3 text-sm space-y-1">
            {ev.shippingStatus === "not_included" ? <div className="flex justify-between gap-3"><dt>Livraison et pose</dt><dd>non comprises</dd></div> : <div className="flex justify-between"><dt>Livraison</dt><dd>{ev.shippingCents === null ? "à confirmer" : <Price cents={ev.shippingCents} />}</dd></div>}
            <div className="flex justify-between text-lg font-semibold"><dt>Total TTC</dt><dd><Price cents={ev.totalCents} /></dd></div>
          </dl>
          {ev.systemOnly ? <p className="mt-3 text-xs text-stone-700">Structure au prix de la grille (HT), TVA de {ev.lines[0]?.result.lines[0] ? ev.lines[0].result.lines[0].taxRateBps / 100 : 20} % comprise. {SYSTEM_DELIVERY_LABEL}, avec le délai de fabrication.</p> : <p className="mt-3 text-xs text-stone-700">Le montant sera revalidé au moment du paiement en fonction de l'adresse de livraison saisie.</p>}
        </aside>
      </div>
    </div>
  );
}
