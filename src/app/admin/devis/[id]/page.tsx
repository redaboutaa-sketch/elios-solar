import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { QuoteStatus } from "@/generated/prisma/enums";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { IssueList } from "@/components/ui/alert";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { Flash, Options, PageTitle, QUOTE_STATUS_FR, Section, Table, fmtDate } from "@/components/admin/ui";
import { centsToEuros, toDateInput } from "@/server/admin/form";
import { updateQuoteAction } from "@/server/actions/admin/quotes";
import type { ConfigurationInput, EvaluationResult } from "@/domain/types";

export const metadata: Metadata = { title: "Détail du devis" };

export default async function QuoteAdminPage(props: PageProps<"/admin/devis/[id]">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await props.params;
  const quote = await prisma.quote.findUnique({ where: { id }, include: { configuration: { select: { id: true, shareToken: true, shareRevoked: true } } } });
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
              {quote.configuration && <><dt className="text-stone-700">Configuration</dt><dd>{quote.configuration.shareRevoked ? "lien révoqué" : <a className="underline" href={`/projets/${quote.configuration.shareToken}`}>Ouvrir le projet</a>}</dd></>}
            </dl>
            {quote.message && <p className="mt-3 whitespace-pre-wrap rounded bg-sand-100 p-3 text-sm">{quote.message}</p>}
          </Section>
          <Section title="Instantané de la configuration">
            {!result ? <p className="text-sm text-stone-700">Aucune configuration jointe.</p> : (
              <>
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
            <div><label className="label" htmlFor="status">Statut</label><select id="status" name="status" className="input" defaultValue={quote.status}><Options values={Object.values(QuoteStatus)} labels={QUOTE_STATUS_FR} /></select><p className="mt-1 text-xs text-stone-700">Le passage à « Envoyé » adresse un e-mail au client.</p></div>
            <div><label className="label" htmlFor="proposedTotal">Montant proposé TTC (€)</label><input id="proposedTotal" name="proposedTotal" inputMode="decimal" className="input" defaultValue={centsToEuros(quote.proposedTotalCents)} /></div>
            <div><label className="label" htmlFor="validUntil">Valable jusqu'au</label><input id="validUntil" name="validUntil" type="date" className="input" defaultValue={toDateInput(quote.validUntil)} /></div>
            <div><label className="label" htmlFor="adminNotes">Notes internes</label><textarea id="adminNotes" name="adminNotes" rows={5} className="input" defaultValue={quote.adminNotes ?? ""} /></div>
            <button className="btn-primary w-full" type="submit">Enregistrer</button>
          </form>
        </Section>
      </div>
    </div>
  );
}
