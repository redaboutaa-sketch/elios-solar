import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Flash, PageTitle, Section, StatusBadge, Table, fmtDate } from "@/components/admin/ui";
import { uploadAction } from "@/server/actions/admin/tariffs";
import { ConfidentialNote } from "../labels";

export const metadata: Metadata = { title: "Importer des tarifs" };

const STATUS_FR: Record<string, string> = { ANALYSED: "À importer", IMPORTED: "Importé", CANCELLED: "Abandonné" };

export default async function ImportPage(props: PageProps<"/admin/tarifs/import">) {
  await requireRole(["ADMIN"]);
  const uploads = await prisma.priceImportUpload.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { files: { select: { fileName: true, sha256: true, size: true } } } });
  return (
    <div className="space-y-6">
      <PageTitle title="Importer des tarifs" backHref="/admin/tarifs" backLabel="Tarifs" />
      <Flash searchParams={props.searchParams} />
      <ConfidentialNote />
      <Section title="1. Téléverser">
        <ol className="mb-3 list-decimal pl-5 text-sm text-stone-800">
          <li>Téléverser le classeur (.xlsx) et, si besoin, les fiches (.docx) des mêmes produits : elles sont rapprochées du classeur. Catalogues fournisseur (SELT) : reporter les tarifs au <strong>format normalisé</strong> (.csv ou .xlsx, en-têtes et règles dans <code>docs/pricing/selt-import.md</code>) — une ligne par prix, avec sa localisation dans le catalogue, sa nature (catalogue fournisseur, achat net, vente), sa devise et HT/TTC ; les produits sont rapprochés par la référence fournisseur.</li>
          <li>Analyser et prévisualiser : produits reconnus, grilles, unités, montants interprétés, cellules inexploitables, changements.</li>
          <li>Corriger les correspondances (produit, variante, axe ; nature, devise et HT/TTC de chaque colonne).</li>
          <li>Importer : des <strong>brouillons</strong> de grille sont créés. Rien n'est publié ; un fichier déjà importé n'est pas dupliqué.</li>
        </ol>
        <form action={uploadAction} className="flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col">Fichiers (.xlsx, .docx, .csv — 8 Mo au total)<input type="file" name="files" multiple accept=".xlsx,.docx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="input" required data-testid="upload-input" /></label>
          <button className="btn-primary" type="submit">Analyser</button>
        </form>
        <p className="mt-2 text-xs text-stone-700">Les fichiers restent privés : enregistrés en base le temps de l'analyse puis effacés à l'import ou à l'abandon. Les formules ne sont jamais recalculées, les liens externes jamais suivis, aucune macro n'est exécutée.</p>
      </Section>
      <Section title="Téléversements récents">
        <Table caption="Téléversements">
          <thead><tr><th>Date</th><th>Fichiers</th><th>Par</th><th>Statut</th></tr></thead>
          <tbody>
            {uploads.map((u) => <tr key={u.id}><td><Link className="underline" href={`/admin/tarifs/import/${u.id}`}>{fmtDate(u.createdAt)}</Link></td><td>{u.files.map((f) => <div key={f.sha256 + f.fileName}>{f.fileName} <span className="font-mono text-xs text-stone-700">{f.sha256.slice(0, 10)}</span></div>)}</td><td>{u.createdBy ?? "—"}</td><td><StatusBadge tone={u.status === "IMPORTED" ? "ok" : u.status === "CANCELLED" ? "neutral" : "warn"}>{STATUS_FR[u.status] ?? u.status}</StatusBadge></td></tr>)}
            {!uploads.length && <tr><td colSpan={4} className="text-stone-700">Aucun.</td></tr>}
          </tbody>
        </Table>
        <p className="mt-2 text-xs text-stone-700">Imports antérieurs (ligne de commande) : <Link className="underline" href="/admin/catalogue/tarifs-fournisseur">fichiers importés</Link>.</p>
      </Section>
    </div>
  );
}
