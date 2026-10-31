import { formatSystemPrice } from "@/domain/system-pricing";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { listConfigurations } from "@/server/configuration/service";
import { AccountNav } from "@/components/account/account-nav";
import { Price } from "@/components/ui/price";
import { duplicateProjectAction, toggleShareAction } from "@/server/actions/account";
import type { EvaluationResult } from "@/domain/types";
import { BRAND } from "@/config/brand";
import { currentProductName } from "@/domain/nomenclature";
export const metadata: Metadata = { title: "Mes projets", robots: { index: false } };
const STATUS: Record<string, string> = { VALID: "Prête à commander", NEEDS_REVIEW: "Points à confirmer", QUOTE_REQUIRED: "Sur devis", DRAFT: "Brouillon" };
export default async function Page() {
  const session = await requireUser("/compte/projets");
  const list = await listConfigurations({ userId: session.user.id, guestKey: await getGuestKey() });
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Mes projets</h1><div className="mt-4"><AccountNav current="/compte/projets" /></div>
      {list.length === 0 ? <div className="mt-8 card p-8 text-center"><p>Aucun projet sauvegardé.</p><Link href="/configurateur" className="btn-accent mt-4">Configurer un projet</Link></div> : (
        <ul className="mt-8 space-y-3">{list.map((c) => { const r = c.result as unknown as EvaluationResult; return (
          <li key={c.id} className="card p-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div><p className="font-medium">{c.title ?? "Projet sans nom"} <span className="text-xs text-stone-700">v{c.version} · {c.updatedAt.toLocaleDateString("fr-FR")}</span></p><p className="text-sm text-stone-700">{r.priceMode === "quote" ? <>{currentProductName(r.recap?.find((x) => x.label === "Produit")?.value ?? "Configuration")} · {r.systemPrice ? `structure ${formatSystemPrice(r.systemPrice.amountMinor, r.systemPrice.currency, r.systemPrice.taxBasis)}` : "prix sur devis"}</> : <>{r.lines[0]?.label} · <Price cents={r.totals.totalGrossCents} /></>} · {STATUS[c.status]}</p>{!c.shareRevoked && <p className="text-xs break-all">Partage : {BRAND.siteUrl}/projets/{c.shareToken}</p>}</div>
            <div className="flex flex-wrap gap-2 items-start">
              {c.kind === "system" && <Link href={`/configurateur/${(c.input as { familySlug?: string }).familySlug}?projet=${c.id}`} className="btn-primary py-2">Reprendre</Link>}
              {c.kind === "pergola_standard" && <Link href={`/configurateur?projet=${c.id}`} className="btn-ghost py-2" title="Ancien catalogue : recommencer avec un modèle actuel">Ancien catalogue</Link>}
              <a href={`/projets/${c.shareToken}/pdf`} className="btn-secondary py-2">PDF</a>
              <form action={duplicateProjectAction}><input type="hidden" name="id" value={c.id} /><button className="btn-secondary py-2">Dupliquer</button></form>
              <form action={toggleShareAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="revoke" value={c.shareRevoked ? "0" : "1"} /><button className="btn-ghost py-2">{c.shareRevoked ? "Réactiver le partage" : "Révoquer le lien"}</button></form>
            </div>
          </li>); })}</ul>
      )}
    </div>
  );
}
