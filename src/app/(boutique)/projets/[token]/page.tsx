import { formatSystemPrice } from "@/domain/system-pricing";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PlanPreview } from "@/components/configurator/plan-preview";
import { IssueList, Notice } from "@/components/ui/alert";
import { Price } from "@/components/ui/price";
import { DemoBadge } from "@/components/ui/demo-badge";
import { getConfigurationWithRevalidation } from "@/server/configuration/service";
import type { PergolaStandardInput } from "@/domain/types";

export const metadata: Metadata = { title: "Projet partagé", robots: { index: false, follow: false } };

export default async function SharedProjectPage(props: PageProps<"/projets/[token]">) {
  const { token } = await props.params;
  const data = await getConfigurationWithRevalidation({ shareToken: token });
  if (!data) notFound();
  const { configuration, result, diff } = data;
  const input = result.input;
  return (
    <div className="container-x py-8">
      <Breadcrumbs items={[{ label: "Projet partagé" }]} />
      <h1 className="mt-4 font-display text-4xl">{configuration.title ?? "Projet de pergola"}</h1>
      <p className="mt-1 text-sm text-stone-700">Version {configuration.version} · validée le {configuration.lastValidatedAt.toLocaleDateString("fr-FR")} · aucune donnée personnelle n'est partagée.</p>
      {diff?.priceChanged && <div className="mt-4"><Notice tone="warn">Le prix a été mis à jour depuis la sauvegarde : {diff.previousTotalCents / 100} € → {diff.newTotalCents / 100} €.</Notice></div>}
      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div className="card p-3">{result.layout ? <PlanPreview layout={result.layout} segments={input.kind === "pergola_standard" ? (input as PergolaStandardInput).segments : {}} /> : <p className="p-4 text-sm">Pas de plan pour ce type de configuration.</p>}</div>
        <div className="card p-5">
          {result.priceMode === "quote" ? (
            <><dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">{(result.recap ?? []).map((x, i) => <div key={`${x.label}-${i}`} className="contents"><dt className="text-stone-700">{x.label}</dt><dd>{x.value}{x.status === "to_confirm" ? " (à confirmer)" : ""}</dd></div>)}</dl><p className="mt-3 text-sm font-medium">{result.systemPrice ? <>Prix de la structure : {formatSystemPrice(result.systemPrice.amountMinor, result.systemPrice.currency, result.systemPrice.taxBasis)} — options, pose et livraison au devis.</> : "Prix sur devis pour ces dimensions."}</p></>
          ) : <table className="w-full text-sm"><tbody>{result.lines.map((l) => <tr key={l.code + (l.path ?? "")} className="border-b border-sand-200"><td className="py-2">{l.label}{l.qty > 1 && ` × ${l.qty}`}</td><td className="py-2 text-right">{l.included ? "inclus" : <Price cents={l.totalGrossCents} />}</td></tr>)}<tr className="font-semibold text-lg"><td className="pt-3">Total TTC {result.totals.isFinal ? "" : "(hors livraison)"}</td><td className="pt-3 text-right"><Price cents={result.totals.totalGrossCents} /></td></tr></tbody></table>}
          {result.containsDemoData && <DemoBadge className="mt-2" />}
          <IssueList issues={result.issues.filter((i) => i.severity !== "info")} className="mt-4" />
          <div className="mt-5 flex flex-wrap gap-2">
            {input.kind === "system" && <Link href={`/configurateur/${input.familySlug}?projet=${configuration.shareToken}`} className="btn-primary">Ouvrir dans le configurateur</Link>}
            <a href={`/projets/${configuration.shareToken}/pdf`} className="btn-secondary">Télécharger le PDF</a>
          </div>
        </div>
      </div>
    </div>
  );
}
