import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { FULFILLMENT_FR, ORDER_STATUS_FR } from "@/components/account/order-detail";
import { Flash, PageTitle, Section, Table, fmtDate } from "@/components/admin/ui";
import { demoRefundAction, updateFulfillmentAction, updateOrderNotesAction } from "@/server/actions/admin/orders";
import type { EvaluationResult, PergolaStandardInput } from "@/domain/types";
import type { FulfillmentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Détail de commande" };

const NEXT_STEP: Partial<Record<FulfillmentStatus, FulfillmentStatus>> = { UNFULFILLED: "PREPARING", PREPARING: "SHIPPED", SHIPPED: "DELIVERED" };

type Addr = { firstName?: string; lastName?: string; company?: string; line1?: string; line2?: string; postalCode?: string; city?: string; countryCode?: string; phone?: string };
function Address({ a }: { a: Addr }) {
  return <address className="not-italic text-sm leading-relaxed">{a.firstName} {a.lastName}{a.company && <><br />{a.company}</>}<br />{a.line1}{a.line2 && <><br />{a.line2}</>}<br />{a.postalCode} {a.city} {a.countryCode}{a.phone && <><br />Tél. {a.phone}</>}</address>;
}

export default async function OrderAdminPage(props: PageProps<"/admin/commandes/[id]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: { events: { orderBy: { receivedAt: "asc" } }, refunds: { orderBy: { createdAt: "asc" } } } },
      reservations: { include: { variant: { select: { sku: true } } }, orderBy: { createdAt: "asc" } },
      user: { select: { id: true, email: true } },
    },
  });
  if (!order) notFound();
  const snapshots = order.lines
    .map((l) => l.configurationSnapshot as { input?: PergolaStandardInput; result?: EvaluationResult } | null)
    .filter((s): s is { input: PergolaStandardInput; result: EvaluationResult } => !!s?.result?.layout && !!s.input);
  const next = NEXT_STEP[order.fulfillmentStatus];
  const delivery = order.delivery as { postalCode?: string; shippingLabel?: string } | null;
  return (
    <div className="space-y-6">
      <PageTitle title={`Commande ${order.number}`} backHref="/admin/commandes" backLabel="Commandes">
        <div className="flex flex-wrap gap-2 text-sm"><span className="badge bg-sand-100 border border-sand-300">{ORDER_STATUS_FR[order.status] ?? order.status}</span><span className="badge bg-sand-100 border border-sand-300">{FULFILLMENT_FR[order.fulfillmentStatus]}</span>{(order.isDemo || order.containsDemoData) && <DemoBadge label="Démonstration" />}</div>
      </PageTitle>
      <Flash searchParams={props.searchParams} />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Section title="Lignes (figées à la commande)">
          <Table caption="Lignes de commande">
            <thead><tr><th>Libellé</th><th>Type</th><th>SKU</th><th className="text-right">Qté</th><th className="text-right">PU TTC</th><th className="text-right">Total TTC</th><th className="text-right">TVA</th></tr></thead>
            <tbody>
              {order.lines.map((l) => <tr key={l.id}><td>{l.label}</td><td>{l.kind}</td><td className="font-mono text-xs">{l.sku ?? "—"}</td><td className="text-right">{l.qty}</td><td className="text-right"><Price cents={l.unitGrossCents} showCents /></td><td className="text-right">{l.included ? "inclus" : <Price cents={l.totalGrossCents} showCents />}</td><td className="text-right">{l.taxRateBps / 100} %</td></tr>)}
            </tbody>
          </Table>
          <dl className="mt-4 grid max-w-sm grid-cols-2 gap-y-1 text-sm">
            <dt>Produits</dt><dd className="text-right"><Price cents={order.goodsCents} showCents /></dd>
            <dt>Montage</dt><dd className="text-right"><Price cents={order.installationCents} showCents /></dd>
            <dt>Livraison</dt><dd className="text-right"><Price cents={order.shippingCents} showCents /></dd>
            <dt>Remise</dt><dd className="text-right">− <Price cents={order.discountCents} showCents /></dd>
            <dt className="font-semibold">Total TTC</dt><dd className="text-right font-semibold"><Price cents={order.totalCents} showCents /></dd>
            <dt className="text-stone-700">dont TVA</dt><dd className="text-right text-stone-700"><Price cents={order.taxCents} showCents /></dd>
          </dl>
          <p className="mt-3 text-xs text-stone-700">Les lignes sont figées : une modification ultérieure du catalogue ne les affecte pas.</p>
        </Section>

        <div className="space-y-6">
          <Section title="Client">
            <p className="text-sm break-all">{order.email}{order.user ? " (compte client)" : " (invité)"}</p>
            <p className="mt-1 text-xs text-stone-700">Créée le {fmtDate(order.createdAt)}{order.paidAt && ` · payée le ${fmtDate(order.paidAt)}`}{order.expiresAt && ` · expire le ${fmtDate(order.expiresAt)}`}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><h3 className="text-sm font-medium">Livraison</h3><Address a={order.shippingAddress as Addr} />{delivery?.shippingLabel && <p className="mt-1 text-xs text-stone-700">Zone : {delivery.shippingLabel}</p>}</div>
              <div><h3 className="text-sm font-medium">Facturation</h3><Address a={order.billingAddress as Addr} /></div>
            </div>
            {order.customerNotes && <p className="mt-3 rounded bg-sand-100 p-2 text-sm"><strong>Note client :</strong> {order.customerNotes}</p>}
          </Section>

          <Section title="Logistique">
            <p className="text-sm">Statut actuel : <strong>{FULFILLMENT_FR[order.fulfillmentStatus]}</strong></p>
            <div className="mt-3 flex flex-wrap gap-2">
              {next && (
                <form action={updateFulfillmentAction}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="to" value={next} /><button className="btn-primary" type="submit">Passer à « {FULFILLMENT_FR[next]} »</button></form>
              )}
              {order.fulfillmentStatus !== "DELIVERED" && order.fulfillmentStatus !== "CANCELLED" && (
                <form action={updateFulfillmentAction}><input type="hidden" name="orderId" value={order.id} /><input type="hidden" name="to" value="CANCELLED" /><button className="btn-secondary" type="submit">Annuler la préparation</button></form>
              )}
            </div>
          </Section>

          <Section title="Notes internes">
            <form action={updateOrderNotesAction} className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <label className="label" htmlFor="adminNotes">Notes (non visibles du client)</label>
              <textarea id="adminNotes" name="adminNotes" rows={4} className="input" defaultValue={order.adminNotes ?? ""} />
              <button className="btn-secondary" type="submit">Enregistrer les notes</button>
            </form>
          </Section>
        </div>
      </div>

      <Section title="Paiements">
        {order.payments.length === 0 && <p className="text-sm text-stone-700">Aucun paiement.</p>}
        <div className="space-y-5">
          {order.payments.map((p) => {
            const refunded = p.refunds.filter((r) => r.status === "SUCCEEDED").reduce((s, r) => s + r.amountCents, 0);
            const refundable = p.provider === "DEMO" && (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") && refunded < p.amountCents;
            return (
              <div key={p.id} className="rounded-lg border border-sand-200 p-4">
                <p className="text-sm"><strong>{p.provider}</strong> · {p.status} · <Price cents={p.amountCents} showCents /> · réf. <span className="font-mono text-xs">{p.providerRef ?? "—"}</span> · {fmtDate(p.createdAt)}</p>
                {p.failureReason && <p className="text-sm text-danger">{p.failureReason}</p>}
                {p.refunds.length > 0 && <ul className="mt-2 text-sm">{p.refunds.map((r) => <li key={r.id}>Remboursement <Price cents={r.amountCents} showCents /> — {r.status} — {fmtDate(r.createdAt)}</li>)}</ul>}
                <h3 className="mt-3 text-sm font-medium">Événements</h3>
                <Table caption="Événements de paiement">
                  <thead><tr><th>Reçu</th><th>Type</th><th>Identifiant</th><th>Résultat</th></tr></thead>
                  <tbody>{p.events.map((e) => <tr key={e.id}><td>{fmtDate(e.receivedAt)}</td><td>{e.type}</td><td className="font-mono text-xs">{e.eventId}</td><td>{e.outcome ?? "—"}</td></tr>)}{p.events.length === 0 && <tr><td colSpan={4} className="text-stone-700">Aucun événement.</td></tr>}</tbody>
                </Table>
                {refundable && (
                  <form action={demoRefundAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="paymentId" value={p.id} />
                    <div><label className="label" htmlFor={`amount-${p.id}`}>Montant (€, vide = solde de {((p.amountCents - refunded) / 100).toFixed(2)} €)</label><input id={`amount-${p.id}`} name="amount" inputMode="decimal" className="input w-48" /></div>
                    <button className="btn-secondary" type="submit">Rembourser (démo)</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="Réservations de stock">
        <Table caption="Réservations de stock">
          <thead><tr><th>SKU</th><th className="text-right">Qté</th><th>Statut</th><th>Expiration</th></tr></thead>
          <tbody>{order.reservations.map((r) => <tr key={r.id}><td className="font-mono text-xs">{r.variant.sku}</td><td className="text-right">{r.qty}</td><td>{r.status}</td><td>{fmtDate(r.expiresAt)}</td></tr>)}{order.reservations.length === 0 && <tr><td colSpan={4} className="text-stone-700">Aucune réservation.</td></tr>}</tbody>
        </Table>
      </Section>

      {snapshots.length > 0 && (
        <Section title="Configuration commandée (figée)">
          <div className="grid gap-4 lg:grid-cols-2">
            {snapshots.map((s, i) => <div key={i} className="rounded-lg border border-sand-200 p-2"><PlanPreview layout={s.result.layout!} segments={s.input.kind === "pergola_standard" ? s.input.segments : {}} /></div>)}
          </div>
        </Section>
      )}
    </div>
  );
}
