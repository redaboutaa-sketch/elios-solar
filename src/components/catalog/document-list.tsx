import Link from "next/link";
import { FileText } from "lucide-react";
import type { PublicDocument } from "@/server/documents/queries";
import { DOCUMENT_KIND_FR } from "@/server/documents/versions";
import { DemoBadge } from "@/components/ui/demo-badge";

/** Liste de documents publiés (dernière version de chaque groupe) + lien vers le guide de préparation. */
export function DocumentList({ docs, empty = "Notice de montage et fiche technique : à fournir par le fournisseur. Elles seront publiées ici après validation.", showFamily = false, guide = true }: { docs: PublicDocument[]; empty?: string; showFamily?: boolean; guide?: boolean }) {
  return (
    <div className="space-y-4">
      {docs.length === 0 ? <p className="text-stone-800">{empty}</p> : (
        <ul className="divide-y divide-sand-200 rounded-xl border border-sand-200 bg-white" data-testid="document-list">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-start gap-3 p-4">
              <FileText className="size-5 shrink-0 text-brand-600 mt-0.5" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{d.href ? <a href={d.href} className="underline" target="_blank" rel="noopener">{d.title}</a> : d.title}</p>
                <p className="text-xs text-stone-700">{DOCUMENT_KIND_FR[d.kind] ?? d.kind} · version {d.version}{d.publishedAt ? ` · publiée le ${d.publishedAt.toLocaleDateString("fr-FR")}` : ""}{showFamily && d.familyName ? ` · ${d.familyName}` : ""}{d.variantSku ? ` · réf. ${d.variantSku}` : ""}{d.href ? " · PDF" : ""}</p>
                {d.summary && <p className="mt-1 text-sm text-stone-800">{d.summary}</p>}
              </div>
              {d.dataStatus === "DEMO" && <DemoBadge label="démo" />}
            </li>
          ))}
        </ul>
      )}
      {guide && <p className="text-sm"><Link href="/guides/preparation-projet" className="underline">Guide : préparer son projet et prendre les mesures</Link></p>}
    </div>
  );
}
