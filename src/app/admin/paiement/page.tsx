import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Notice } from "@/components/ui/alert";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { centsToEuros } from "@/server/admin/form";
import { getInstallmentSettings, installmentsRuntimeStatus } from "@/server/payment/installments";
import { PROVIDER_BOUNDS, installmentEligibility, type InstallmentProviderKey } from "@/server/payment/installments-rules";
import { updateInstallmentSettingsAction } from "@/server/actions/admin/installments";

export const metadata: Metadata = { title: "Paiement fractionné" };

const yes = (b: boolean) => <StatusBadge tone={b ? "ok" : "warn"}>{b ? "oui" : "non"}</StatusBadge>;

export default async function InstallmentsAdminPage(props: PageProps<"/admin/paiement">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const s = await getInstallmentSettings();
  const st = installmentsRuntimeStatus(s);
  const lastAudit = await prisma.auditLog.findFirst({ where: { entity: "InstallmentSettings", action: "installments.settings" }, orderBy: { createdAt: "desc" } });
  const meta = (lastAudit?.after ?? {}) as { merchantNote?: string | null; merchantDate?: string | null };
  const recent = await prisma.payment.findMany({ where: { method: "installments" }, orderBy: { createdAt: "desc" }, take: 10, include: { order: { select: { id: true, number: true } } } });
  const samples = [150_000, 290_000, 450_000, 620_000].map((t) => ({ t, r: installmentEligibility({ totalCents: t, countryCode: "FR", settings: s, env: st.env }) }));
  return (
    <div className="space-y-6">
      <PageTitle title="Paiement fractionné" />
      <Flash searchParams={props.searchParams} />

      <Section title="État">
        <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-stone-700">Environnement courant</dt><dd data-testid="env"><StatusBadge tone={st.env === "prod" ? "err" : "demo"}>{st.env === "prod" ? "production (clé live)" : "test"}</StatusBadge></dd></div>
          <div><dt className="text-stone-700">Prestataire sélectionné</dt><dd><strong>{st.provider.label}</strong></dd></div>
          <div><dt className="text-stone-700">Proposé aux clients</dt><dd data-testid="operational">{yes(st.operational)}</dd></div>
          <div><dt className="text-stone-700">PAYMENT_PROVIDER</dt><dd className="font-mono">{process.env.PAYMENT_PROVIDER ?? "demo"}</dd></div>
          <div><dt className="text-stone-700">Clé secrète Stripe présente</dt><dd>{yes(st.stripeKeyPresent)}</dd></div>
          <div><dt className="text-stone-700">Secret de webhook Stripe présent</dt><dd>{yes(st.stripeWebhookPresent)}</dd></div>
          <div><dt className="text-stone-700">Secret HMAC du simulateur présent</dt><dd>{yes(st.demoWebhookSecretPresent)}</dd></div>
          <div><dt className="text-stone-700">Compte marchand validé</dt><dd>{yes(s.merchantEligible)}{(meta.merchantDate || meta.merchantNote) && <span className="ml-2 text-xs text-stone-700">{meta.merchantDate} {meta.merchantNote}</span>}</dd></div>
        </dl>
        {st.blockers.length > 0 && <div className="mt-3"><Notice tone="warn">Non proposé : {st.blockers.join(" ; ")}.</Notice></div>}
        <p className="mt-3 text-xs text-stone-700">Les valeurs des clés ne sont jamais affichées. L'activation en production exige un prestataire réel (Klarna ou Alma via Stripe), une clé live et la validation du compte marchand. Voir <Link href="https://docs.stripe.com/payments/alma" className="underline">Alma</Link> et <Link href="https://docs.stripe.com/payments/klarna" className="underline">Klarna</Link> (documentation Stripe).</p>
      </Section>

      <form action={updateInstallmentSettingsAction} className="space-y-6">
        <Section title="Prestataire et activation">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="provider">Prestataire</label>
              <select id="provider" name="provider" className="input" defaultValue={s.provider}>
                {(Object.keys(PROVIDER_BOUNDS) as InstallmentProviderKey[]).map((k) => <option key={k} value={k}>{PROVIDER_BOUNDS[k].label}{PROVIDER_BOUNDS[k].minCents !== null ? ` — ${PROVIDER_BOUNDS[k].counts.join("/")} fois, ${centsToEuros(PROVIDER_BOUNDS[k].minCents)}–${centsToEuros(PROVIDER_BOUNDS[k].maxCents)} €` : ""}</option>)}
              </select>
            </div>
            <div className="space-y-2 self-end pb-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="enabledTest" className="h-4 w-4" defaultChecked={s.enabledTest} /> Activé en environnement de test</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="enabledProd" className="h-4 w-4" defaultChecked={s.enabledProd} /> Activé en production (prestataire réel + compte validé obligatoires)</label>
            </div>
            <div className="md:col-span-2 rounded-lg border border-sand-200 p-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="merchantEligible" className="h-4 w-4" defaultChecked={s.merchantEligible} /> Compte marchand validé par le prestataire</label>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div><label className="label" htmlFor="merchantDate">Date de validation</label><input id="merchantDate" name="merchantDate" type="date" className="input" defaultValue={meta.merchantDate ?? ""} /></div>
                <div><label className="label" htmlFor="merchantNote">Note / référence</label><input id="merchantNote" name="merchantNote" className="input" defaultValue={meta.merchantNote ?? ""} /></div>
              </div>
            </div>
          </div>
        </Section>
        <Section title="Bornes, échéances et frais">
          <div className="grid gap-4 md:grid-cols-3">
            <div><label className="label" htmlFor="min">Montant minimum (€)</label><input id="min" name="min" className="input" defaultValue={centsToEuros(s.minCents)} /></div>
            <div><label className="label" htmlFor="max">Montant maximum (€)</label><input id="max" name="max" className="input" defaultValue={centsToEuros(s.maxCents)} /></div>
            <div><label className="label" htmlFor="countries">Pays de livraison (ISO)</label><input id="countries" name="countries" className="input" defaultValue={s.countries.join(", ")} /></div>
            <div><label className="label" htmlFor="installmentCounts">Nombres d'échéances</label><input id="installmentCounts" name="installmentCounts" className="input" defaultValue={s.installmentCounts.join(", ")} aria-describedby="counts-hint" /><p id="counts-hint" className="mt-1 text-xs text-stone-700">ex. 3 (Klarna) ou 2, 3, 4 (Alma)</p></div>
            <div><label className="label" htmlFor="feesBps">Frais client (points de base)</label><input id="feesBps" name="feesBps" inputMode="numeric" className="input" defaultValue={String(s.feesBps)} aria-describedby="bps-hint" /><p id="bps-hint" className="mt-1 text-xs text-stone-700">100 = 1 %</p></div>
            <div><label className="label" htmlFor="feesFixed">Frais fixes client (€)</label><input id="feesFixed" name="feesFixed" className="input" defaultValue={centsToEuros(s.feesFixedCents)} /></div>
            <div><label className="label" htmlFor="feesLabel">Libellé des frais</label><input id="feesLabel" name="feesLabel" className="input" defaultValue={s.feesLabel} /></div>
            <div className="md:col-span-2"><label className="label" htmlFor="termsUrl">URL des CGU du prestataire</label><input id="termsUrl" name="termsUrl" type="url" className="input" defaultValue={s.termsUrl ?? ""} /></div>
            <label className="md:col-span-3 flex items-center gap-2 text-sm"><input type="checkbox" name="noFeesConfirmed" className="h-4 w-4" defaultChecked={s.noFeesConfirmed} /> « Sans frais » confirmé par le contrat prestataire (sinon, jamais affiché)</label>
          </div>
        </Section>
        <button className="btn-primary" type="submit">Enregistrer les réglages</button>
      </form>

      <Section title="Aperçu d'éligibilité (livraison FR)">
        <Table caption="Aperçu d'éligibilité">
          <thead><tr><th>Montant</th><th>Éligible</th><th>Détail</th></tr></thead>
          <tbody>{samples.map(({ t, r }) => <tr key={t}><td>{centsToEuros(t)} €</td><td>{r.eligible ? "oui" : "non"}</td><td>{r.eligible ? r.plans.map((p) => `${p.count}× : ${centsToEuros(p.firstCents)} € puis ${centsToEuros(p.otherCents)} €`).join(" · ") : r.reasons.join(" ; ")}</td></tr>)}</tbody>
        </Table>
      </Section>

      <Section title="Derniers paiements fractionnés">
        <Table caption="Derniers paiements fractionnés">
          <thead><tr><th>Date</th><th>Commande</th><th>Prestataire</th><th>Échéances</th><th>Statut</th></tr></thead>
          <tbody>{recent.map((p) => <tr key={p.id}><td>{fmtDate(p.createdAt)}</td><td><Link className="underline" href={`/admin/commandes/${p.order.id}`}>{p.order.number}</Link></td><td>{p.planProvider}</td><td>{p.installments}</td><td>{p.status}</td></tr>)}{recent.length === 0 && <tr><td colSpan={5} className="text-stone-700">Aucun.</td></tr>}</tbody>
        </Table>
      </Section>
    </div>
  );
}
