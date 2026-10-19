import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IssueList, Notice } from "@/components/ui/alert";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { evaluateCart, findActiveCart } from "@/server/cart/service";
import { removeLineAction, setDeliveryAction, updateQtyAction } from "@/server/actions/cart";
import { summarizeStandard } from "@/domain/helpers";
import { loadCatalog } from "@/server/catalog/load";
import { estimateCartDelivery } from "@/server/stock/delivery";
import { DeliveryEstimateBlock } from "@/components/catalog/delivery-estimate";

export const metadata: Metadata = { title: "Panier", robots: { index: false } };

export default async function CartPage() {
  const [session, guestKey, catalog] = await Promise.all([getSession(), getGuestKey(), loadCatalog()]);
  const cart = await findActiveCart({ userId: session?.user.id, guestKey });
  const ev = cart && cart.lines.length ? await evaluateCart(cart, catalog) : null;
  const estimate = ev ? await estimateCartDelivery(ev, catalog) : null;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Panier" }]} />
      <h1 className="mt-4 font-display text-4xl">Votre panier</h1>
      {!ev ? (
        <div className="mt-8 card p-10 text-center"><p className="font-display text-2xl">Votre panier est vide.</p><p className="mt-2 text-stone-700">Composez votre pergola ou choisissez un accessoire compatible.</p><div className="mt-4 flex justify-center gap-2"><Link href="/configurateur" className="btn-accent">Configurer une pergola</Link><Link href="/accessoires" className="btn-secondary">Accessoires</Link></div></div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <ul className="space-y-4">
            {ev.lines.map(({ line, input, result, lineTotalCents }) => (
              <li key={line.id} className="card p-5">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <p className="font-display text-lg">{input.kind === "pergola_standard" ? summarizeStandard(catalog, input) : result.lines[0]?.label}</p>
                    <ul className="mt-2 text-sm text-stone-800 space-y-0.5">{result.lines.filter((l) => l.kind !== "base" && l.kind !== "shipping").map((l) => <li key={l.code + (l.path ?? "")}>· {l.label}{l.qty > 1 && ` × ${l.qty}`} — {l.included ? "inclus" : <Price cents={l.totalGrossCents} />}</li>)}</ul>
                    {result.containsDemoData && <DemoBadge className="mt-2" />}
                    <IssueList issues={result.issues.filter((i) => i.severity !== "info")} className="mt-2" />
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-semibold"><Price cents={lineTotalCents} /></p>
                    <form action={updateQtyAction} className="mt-2 flex items-center justify-end gap-2"><input type="hidden" name="lineId" value={line.id} /><label className="text-sm" htmlFor={`qty-${line.id}`}>Qté</label><input id={`qty-${line.id}`} name="qty" type="number" min={1} max={10} defaultValue={line.qty} className="input w-20 py-1" /><button className="btn-secondary py-1.5" type="submit">Mettre à jour</button></form>
                    <form action={removeLineAction} className="mt-2"><input type="hidden" name="lineId" value={line.id} /><button className="text-sm underline text-stone-700" type="submit">Retirer</button></form>
                    {input.kind === "pergola_standard" && <Link href={`/configurateur?ligne=${line.id}`} className="block mt-2 text-sm underline">Modifier la configuration</Link>}
                    {input.kind === "awning" && <Link href={`/configurateur/store-banne?ligne=${line.id}`} className="block mt-2 text-sm underline">Modifier le store</Link>}
                    {input.kind === "accessory" && <Link href={`/accessoires/${input.familySlug}`} className="block mt-2 text-sm underline">Voir l'accessoire</Link>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="card p-6 self-start lg:sticky lg:top-24">
            <h2 className="font-display text-2xl">Récapitulatif</h2>
            <form action={setDeliveryAction} className="mt-4 grid gap-3">
              <div><label className="label" htmlFor="postalCode">Code postal de livraison</label><input id="postalCode" name="postalCode" className="input" inputMode="numeric" defaultValue={ev.delivery.postalCode ?? ""} placeholder="ex. 69000" /></div>
              <div><label className="label" htmlFor="promotionCode">Code promotionnel</label><input id="promotionCode" name="promotionCode" className="input" defaultValue={cart?.promotionCode ?? ""} /></div>
              <button className="btn-secondary" type="submit">Mettre à jour</button>
            </form>
            <dl className="mt-5 space-y-1 text-sm">
              <div className="flex justify-between"><dt>Produits</dt><dd><Price cents={ev.goodsCents} /></dd></div>
              {ev.installationCents > 0 && <div className="flex justify-between"><dt>Montage</dt><dd><Price cents={ev.installationCents} /></dd></div>}
              {ev.discountCents > 0 && <div className="flex justify-between text-success"><dt>Remise</dt><dd>− <Price cents={ev.discountCents} /></dd></div>}
              <div className="flex justify-between"><dt>Livraison{ev.shippingLabel ? ` — ${ev.shippingLabel}` : ""}</dt><dd>{ev.shippingCents === null ? (ev.shippingStatus === "quote" ? "sur devis" : "code postal requis") : <Price cents={ev.shippingCents} />}</dd></div>
              <div className="flex justify-between border-t border-sand-200 pt-2 text-lg font-semibold"><dt>Total TTC {ev.isFinal ? "" : "(estimé)"}</dt><dd><Price cents={ev.totalCents} /></dd></div>
              <div className="flex justify-between text-xs text-stone-700"><dt>dont TVA</dt><dd><Price cents={ev.taxCents} showCents /></dd></div>
            </dl>
            {estimate && <DeliveryEstimateBlock estimate={estimate} demo={catalog.variants.some((v) => v.leadSource === "demo")} />}
            {!ev.purchasable && <div className="mt-3"><Notice tone="warn">Une ligne nécessite une validation : modifiez-la ou demandez un devis.</Notice></div>}
            {ev.shippingStatus === "quote" && <div className="mt-3"><Notice tone="warn">Livraison sur devis pour cette zone : <Link href="/devis" className="underline">demander un devis</Link>.</Notice></div>}
            <Link href="/commande" aria-disabled={!ev.purchasable || ev.shippingStatus !== "ok"} className={`btn-accent w-full mt-5 ${!ev.purchasable || ev.shippingStatus !== "ok" ? "pointer-events-none opacity-50" : ""}`}>Passer la commande</Link>
            <p className="mt-2 text-xs text-stone-700">Le total est recalculé côté serveur à chaque étape ; aucun montant n'est repris du navigateur.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
