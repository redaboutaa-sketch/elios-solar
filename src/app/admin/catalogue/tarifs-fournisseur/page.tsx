import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { Notice } from "@/components/ui/alert";
import { rejectSupplierPriceListAction } from "@/server/actions/admin/supplier-prices";
import { InterpretationBadges, ListStatusBadge } from "./labels";

export const metadata: Metadata = { title: "Fichiers de tarifs importés" };

/**
 * Versions importées des tarifs fournisseur. Réservé aux administrateurs : aucun montant n'est affiché
 * sur cette page (seulement dans le détail d'une version) et rien n'est jamais publié sur la boutique.
 */
export default async function SupplierPricesPage(props: PageProps<"/admin/catalogue/tarifs-fournisseur">) {
  await requireRole(["ADMIN"]);
  const lists = await prisma.supplierPriceList.findMany({
    where: { scope: "IMPORT" },
    orderBy: [{ sourceKey: "asc" }, { version: "desc" }],
    select: { id: true, sourceKey: true, version: true, label: true, sourceFile: true, sourceSha256: true, status: true, currency: true, taxBasis: true, nature: true, importedBy: true, activatedAt: true, activatedBy: true, createdAt: true },
  });
  const counts = await prisma.supplierPriceRow.groupBy({ by: ["listId", "status"], _count: { _all: true } });
  const countOf = (id: string, s: string) => counts.find((c) => c.listId === id && c.status === s)?._count._all ?? 0;
  const keys = [...new Set(lists.map((l) => l.sourceKey))];
  return (
    <div className="space-y-6">
      <PageTitle title="Fichiers de tarifs importés (privé)" />
      <Flash searchParams={props.searchParams} />
      <Notice tone="warn"><strong>Trace brute des fichiers importés.</strong> Les prix du site ne sont plus lus ici : ils viennent des grilles publiées dans <Link className="underline" href="/admin/tarifs">Tarifs</Link> (une grille par produit et par variante, versionnée, publiée après vérification). Importer un fichier ne publie rien.</Notice>
      <Section title="Importer">
        <p className="text-sm text-stone-700">Depuis l'administration : <Link className="underline" href="/admin/tarifs/import">Tarifs → Importer un classeur</Link>. En ligne de commande, depuis un dossier privé monté en lecture seule (procédure : <code>docs/heliostores/import-tarifs.md</code>). Par défaut l'outil n'écrit rien (aperçu) ; <code>--apply</code> crée une nouvelle version en <strong>brouillon</strong> ; une empreinte identique déjà importée est sans effet.</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-sand-100 p-3 text-xs">pnpm supplier-prices:import --file &quot;&lt;classeur.xlsx&gt;&quot; --file &quot;&lt;fiche.docx&gt;&quot; [--apply]</pre>
      </Section>
      {keys.length === 0 && <Section><p className="text-sm text-stone-700">Aucune version importée.</p></Section>}
      {keys.map((key) => {
        const versions = lists.filter((l) => l.sourceKey === key);
        const active = versions.find((v) => v.status === "ACTIVE");
        return (
          <Section key={key} title={key}>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <span>Version de référence (ancien mode de publication) : {active ? <strong>v{active.version}</strong> : <StatusBadge tone="neutral">aucune</StatusBadge>}</span>
            </div>
            <Table caption={`Versions de ${key}`}>
              <thead><tr><th>Version</th><th>Statut</th><th>Fichier source</th><th>Empreinte</th><th>Interprétation</th><th>OK</th><th>À vérifier</th><th>Rejetées</th><th>Import</th><th /></tr></thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td><Link className="underline" href={`/admin/catalogue/tarifs-fournisseur/${v.id}`}>v{v.version}</Link></td>
                    <td><ListStatusBadge status={v.status} />{v.activatedAt && <div className="text-xs text-stone-700">activée {fmtDate(v.activatedAt)}{v.activatedBy ? ` par ${v.activatedBy}` : ""}</div>}</td>
                    <td className="max-w-56 break-words">{v.sourceFile}<div className="text-xs text-stone-700">{v.label}</div></td>
                    <td className="font-mono text-xs" title="SHA-256 du fichier importé">{v.sourceSha256.slice(0, 12)}</td>
                    <td><InterpretationBadges nature={v.nature} taxBasis={v.taxBasis} currency={v.currency} /></td>
                    <td>{countOf(v.id, "OK")}</td><td>{countOf(v.id, "TO_CHECK")}</td><td>{countOf(v.id, "REJECTED")}</td>
                    <td className="text-xs">{fmtDate(v.createdAt)}<div className="text-stone-700">{v.importedBy ?? "—"}</div></td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {v.status === "DRAFT" && (
                          <form action={rejectSupplierPriceListAction}><input type="hidden" name="id" value={v.id} /><button className="btn-secondary min-h-0 py-1.5" type="submit">Rejeter</button></form>
                        )}
                        <Link className="btn-secondary min-h-0 py-1.5" href={`/admin/catalogue/tarifs-fournisseur/${v.id}`}>Rapport</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
        );
      })}
      <p className="text-xs text-stone-700">Chaque import est inscrit au journal (sans montant). Un fichier de même empreinte n'est jamais importé deux fois.</p>
    </div>
  );
}
