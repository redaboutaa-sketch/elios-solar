import { formatSystemPrice } from "@/domain/system-pricing";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { QuoteStatus } from "@/generated/prisma/enums";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IssueList } from "@/components/ui/alert";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { QuoteVisualCard } from "@/components/quote/quote-visual-card";
import { Flash, Options, PageTitle, QUOTE_STATUS_FR, Section, Table, fmtDate } from "@/components/admin/ui";
import { centsToEuros, toDateInput } from "@/server/admin/form";
import { openQuotePaymentAction, updateQuoteAction } from "@/server/actions/admin/quotes";
import { onlineSalesEnabled } from "@/server/payment/mode";
import { mailDeliveryReal } from "@/server/mail/transport";
import type { ConfigurationInput, EvaluationResult } from "@/domain/types";
import type { Attribution } from "@/domain/attribution";

const QUALIFICATION_FR: Record<string, string> = { TO_QUALIFY: "À qualifier", QUALIFIED: "Qualifié", NOT_QUALIFIED: "Non qualifié" };

export const metadata: Metadata = { title: "Détail du devis" };

export default async function QuoteAdminPage(props: PageProps<"/admin/devis/[id]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: { configuration: { select: { id: true, shareToken: true, shareRevoked: true, version: true } }, visuals: { orderBy: { createdAt: "asc" } } } });
  const quoteOrders = quote ? await prisma.order.findMany({ where: { quoteId: quote.id }, orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { createdAt: "desc" }, include: { refunds: true } } } }) : [];
  const cashed = quoteOrders.flatMap((o) => o.payments).filter((p) => ["SUCCEEDED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)).reduce((t, p) => t + p.amountCents, 0);
  const refunded = quoteOrders.flatMap((o) => o.payments.flatMap((p) => p.refunds)).filter((r) => r.status === "SUCCEEDED").reduce((t, r) => t + r.amountCents, 0);
  if (!quote) notFound();
  const snap = quote.snapshot as { input?: ConfigurationInput | null; result?: EvaluationResult | null } | null;
  const result = snap?.result ?? null;
  const input = snap?.input ?? null;
  return (
    <div className="space-y-6">
      <PageTitle title={`Devis ${quote.number}`} backHref="/admin/devis" backLabel="Devis">
        <div className="flex gap-2"><span className="badge bg-sand-100 border border-sand-300">{QUOTE_STATUS_FR[quote.status]}</span>{quote.containsDemoData && <DemoBadge label="Données de démonstration" />}</div>
      </PageTitle>
      <Flash searchParams={props.searchParams} />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Demande">
            <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
              <dt className="text-stone-700">Client</dt><dd>{quote.firstName} {quote.lastName}</dd>
              <dt className="text-stone-700">E-mail</dt><dd className="break-all">{quote.email}</dd>
              <dt className="text-stone-700">Téléphone</dt><dd>{quote.phone ?? "—"}</dd>
              <dt className="text-stone-700">Code postal</dt><dd>{quote.postalCode ?? "—"}</dd>
              <dt className="text-stone-700">Type</dt><dd>{quote.kind}</dd>
              <dt className="text-stone-700">Reçu le</dt><dd>{fmtDate(quote.createdAt)}</dd>
              <dt className="text-stone-700">Qualification</dt><dd data-testid="quote-qualification">{QUALIFICATION_FR[quote.qualification] ?? quote.qualification}</dd>
              <dt className="text-stone-700">Origine</dt><dd data-testid="quote-attribution">{(() => { const a = quote.attribution as Attribution | null; if (!a) return "non renseignée"; const p = Object.entries(a.params ?? {}).map(([k, v]) => `${k}=${v}`).join(", "); return [p, a.referrerHost ? `référent ${a.referrerHost}` : null, a.landingPath ? `entrée ${a.landingPath}` : null].filter(Boolean).join(" · ") || "non renseignée"; })()}</dd>
              {quote.configuration && <><dt className="text-stone-700">Configuration</dt><dd>{quote.configuration.shareRevoked ? "lien révoqué" : <a className="underline" href={`/projets/${quote.configuration.shareToken}`}>Ouvrir le projet</a>}</dd></>}
            </dl>
            {quote.message && <p className="mt-3 whitespace-pre-wrap rounded bg-sand-100 p-3 text-sm">{quote.message}</p>}
          </Section>
          {input && (
            <Section title="Visualisation jointe">
              <QuoteVisualCard quoteId={quote.id} visual={quote.visuals[0]} admin />
              <p className="mt-3 text-sm"><a className="underline" href={`/api/devis/${quote.id}/pdf`} target="_blank" rel="noopener">PDF du devis (avec visualisation)</a>{quote.configuration && <span className="text-stone-700"> · projet enregistré actuellement en v{quote.configuration.version} : la visualisation du devis reste celle de l'émission.</span>}</p>
            </Section>
          )}
          <Section title="Instantané de la configuration">
            {!result ? <p className="text-sm text-stone-700">Aucune configuration jointe.</p> : (
              result.priceMode === "quote" ? (
                <>
                  <dl data-testid="quote-recap" className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]">{(result.recap ?? []).map((r, i) => <div key={`${r.label}-${i}`} className="contents"><dt className="text-stone-700">{r.label}</dt><dd>{r.value}{r.status === "to_confirm" ? <span className="badge-warn ml-2">à confirmer</span> : r.status === "included" ? <span className="badge-ok ml-2">inclus</span> : null}</dd></div>)}</dl>
                  <p className="mt-3 text-sm" data-testid="quote-system-price">{result.systemPrice ? <>Prix de la structure affiché au client : <strong>{formatSystemPrice(result.systemPrice.amountMinor, result.systemPrice.currency, result.systemPrice.taxBasis)}</strong> (grille de vente {result.systemPrice.versionId ? <Link className="underline" href={`/admin/tarifs/grilles/${result.systemPrice.versionId}`}>v{result.systemPrice.listVersion}</Link> : `v${result.systemPrice.listVersion}`}, cellule {result.systemPrice.grid.widthMm} × {result.systemPrice.grid.dimMm} mm{result.systemPrice.variantKey ? `, ${result.systemPrice.variantKey}` : ""}, prix figé à l'émission). Options, pose et livraison à chiffrer.</> : <>Prix : <strong>sur devis</strong> (cote absente de la grille ou aucune grille en vigueur).</>} Tarifs : <Link className="underline" href="/admin/tarifs">écran Tarifs</Link> (administrateurs).</p>
                  <h3 className="mt-4 text-sm font-medium">Points signalés</h3>
                  {result.issues.length ? <IssueList issues={result.issues} className="mt-2" /> : <p className="text-sm text-stone-700">Aucun.</p>}
                  {result.layout && <div className="mt-4 rounded-lg border border-sand-200 p-2"><PlanPreview layout={result.layout} segments={{}} /></div>}
                </>
              ) : <>
                <Table caption="Lignes estimées">
                  <thead><tr><th>Libellé</th><th>SKU</th><th className="text-right">Qté</th><th className="text-right">Total TTC</th><th>Donnée</th></tr></thead>
                  <tbody>{result.lines.map((l, i) => <tr key={i}><td>{l.label}</td><td className="font-mono text-xs">{l.sku ?? "—"}</td><td className="text-right">{l.qty}</td><td className="text-right">{l.included ? "inclus" : <Price cents={l.totalGrossCents} />}</td><td>{l.dataStatus}</td></tr>)}</tbody>
                </Table>
                <p className="mt-3 text-sm">Total estimé : <strong><Price cents={result.totals.totalGrossCents} /></strong></p>
                <h3 className="mt-4 text-sm font-medium">Points signalés</h3>
                {result.issues.length ? <IssueList issues={result.issues} className="mt-2" /> : <p className="text-sm text-stone-700">Aucun.</p>}
                {result.layout && input?.kind === "pergola_standard" && <div className="mt-4 rounded-lg border border-sand-200 p-2"><PlanPreview layout={result.layout} segments={input.segments} /></div>}
              </>
            )}
          </Section>
        </div>
        <Section title="Traitement" className="self-start">
          <form action={updateQuoteAction} className="space-y-3">
            <input type="hidden" name="quoteId" value={quote.id} />
            <div><label className="label" htmlFor="status">Statut</label><select id="status" name="status" className="input" defaultValue={quote.status}><Options values={Object.values(QuoteStatus)} labels={QUOTE_STATUS_FR} /></select><p className="mt-1 text-xs text-stone-700" data-testid="quote-sent-hint">{mailDeliveryReal() ? "Le passage à « Envoyé » adresse un e-mail au client." : "Le passage à « Envoyé » met un e-mail en file, sans l'envoyer (aucun SMTP raccordé) : transmettez le devis au client vous-même."}</p></div>
            <div><label className="label" htmlFor="qualification">Qualification du prospect</label><select id="qualification" name="qualification" className="input" defaultValue={quote.qualification}>{Object.entries(QUALIFICATION_FR).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div><label className="label" htmlFor="proposedTotal">Montant proposé TTC (€)</label><input id="proposedTotal" name="proposedTotal" inputMode="decimal" className="input" defaultValue={centsToEuros(quote.proposedTotalCents)} /></div>
            <div><label className="label" htmlFor="validUntil">Valable jusqu'au</label><input id="validUntil" name="validUntil" type="date" className="input" defaultValue={toDateInput(quote.validUntil)} /></div>
            <fieldset className="space-y-3 border-t border-sand-200 pt-3" data-testid="quote-outcome">
              <legend className="text-sm font-semibold">Issue commerciale (vente réglée hors ligne)</legend>
              <p className="text-xs text-stone-700">Gagné = statut « Accepté » ; perdu = « Refusé » ou « Expiré ». Laissez le montant vide tant qu&apos;il n&apos;est pas encaissé : il reste « non renseigné » dans le suivi par origine.</p>
              <div><label className="label" htmlFor="cashedNet">Montant HT encaissé (€)</label><input id="cashedNet" name="cashedNet" inputMode="decimal" className="input" defaultValue={centsToEuros(quote.cashedNetCents)} /></div>
              <div><label className="label" htmlFor="cashedAt">Encaissé le</label><input id="cashedAt" name="cashedAt" type="date" className="input" defaultValue={toDateInput(quote.cashedAt)} /></div>
              <div><label className="label" htmlFor="outcomeNote">Motif du gain ou de la perte</label><input id="outcomeNote" name="outcomeNote" maxLength={1000} className="input" defaultValue={quote.outcomeNote ?? ""} /></div>
            </fieldset>
            <div><label className="label" htmlFor="adminNotes">Notes internes</label><textarea id="adminNotes" name="adminNotes" rows={5} className="input" defaultValue={quote.adminNotes ?? ""} /></div>
            <button className="btn-primary w-full" type="submit">Enregistrer</button>
          </form>
          <div className="mt-6 border-t border-sand-200 pt-4" data-testid="quote-payment">
            <h3 className="font-semibold">Paiement en ligne du devis</h3>
            {quoteOrders.length ? (
              <ul className="mt-2 space-y-1 text-sm">{quoteOrders.map((o) => <li key={o.id}><a className="link-brand" href={`/admin/commandes/${o.id}`}>{o.number}</a> — {o.status}{o.payments[0] ? ` · paiement ${o.payments[0].status}${o.payments[0].method ? ` (${o.payments[0].method})` : ""}` : ""} · lien client : <code>/commande/{o.id}/payer</code></li>)}</ul>
            ) : null}
            {quoteOrders.length ? <p className="mt-2 text-sm" data-testid="quote-cashed">Encaissé : {centsToEuros(cashed)} € · remboursé : {centsToEuros(refunded)} € (suivi du prospect : origine ci-dessus → devis → commande → encaissement)</p> : <p className="mt-1 text-xs text-stone-700">Possible lorsque le devis est « Accepté » et que son montant TTC est renseigné. Le client règle exactement ce montant ; un retour de navigateur ne vaut pas paiement (confirmation par le prestataire).</p>}
            {!onlineSalesEnabled() ? <p className="mt-2 text-sm" data-testid="quote-payment-closed">Paiement en ligne non ouvert sur cet environnement (aucun compte de paiement raccordé) : le devis se règle hors ligne.</p> : quote.status === "ACCEPTED" && quote.proposedTotalCents ? (
              <form action={openQuotePaymentAction} className="mt-3 space-y-2">
                <input type="hidden" name="quoteId" value={quote.id} />
                <div><label className="label" htmlFor="vatRate">Taux de TVA du devis (%)</label><input id="vatRate" name="vatRate" inputMode="decimal" required className="input" placeholder="à indiquer" /></div>
                <div><label className="label" htmlFor="payLabel">Libellé (facultatif)</label><input id="payLabel" name="label" maxLength={120} className="input" /></div>
                <button className="btn-secondary w-full" type="submit">Ouvrir le paiement ({new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(quote.proposedTotalCents / 100)} TTC)</button>
              </form>
            ) : null}
          </div>
        </Section>
      </div>
    </div>
  );
}
