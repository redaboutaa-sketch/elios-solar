import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import type { Prisma } from "@/generated/prisma/client";
import { DATA_STATUS_FR, Flash, Options, PageTitle, Pagination, Section, fmtDate } from "@/components/admin/ui";
import { StockImportForm } from "@/components/admin/stock-import-form";
import { updateStockAction } from "@/server/actions/admin/stock";

export const metadata: Metadata = { title: "Stocks et délais" };
const PER_PAGE = 50;
const AVAIL_FR: Record<string, string> = { AVAILABLE: "Disponible", ON_ORDER: "Sur commande", OUT_OF_STOCK: "Rupture", TO_CONFIRM: "À confirmer" };
const UNIT_FR: Record<string, string> = { BUSINESS_DAYS: "jours ouvrés", CALENDAR_DAYS: "jours calendaires", WEEKS: "semaines" };

export default async function StocksPage(props: PageProps<"/admin/catalogue/stocks">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const sp = await props.searchParams;
  const famille = typeof sp.famille === "string" ? sp.famille.slice(0, 80) : "";
  const dispo = typeof sp.dispo === "string" && sp.dispo in AVAIL_FR ? sp.dispo : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.VariantWhereInput = { ...(famille ? { family: { slug: famille } } : {}), ...(dispo ? { availability: dispo as never } : {}), ...(q ? { sku: { contains: q, mode: "insensitive" } } : {}) };
  const [families, total, variants, counts, settings] = await Promise.all([
    prisma.productFamily.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
    prisma.variant.count({ where }),
    prisma.variant.findMany({ where, orderBy: [{ family: { sortOrder: "asc" } }, { sku: "asc" }], skip: (page - 1) * PER_PAGE, take: PER_PAGE, include: { movements: { orderBy: { createdAt: "desc" }, take: 3 } } }),
    prisma.variant.groupBy({ by: ["availability"], _count: true }),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { shipmentPolicy: true } }),
  ]);
  const params = { ...(famille ? { famille } : {}), ...(dispo ? { dispo } : {}), ...(q ? { q } : {}) };
  const returnTo = `/admin/catalogue/stocks?${new URLSearchParams({ ...params, page: String(page) })}`;
  const cell = "input py-1 min-h-0 text-sm";
  return (
    <div className="space-y-6">
      <PageTitle title="Stocks et délais par référence" />
      <Flash searchParams={props.searchParams} />
      <Section>
        <p className="text-sm text-stone-700">Aucune source fournisseur n'est connectée : les valeurs actuelles sont un <strong>jeu de démonstration</strong> (fiabilité « Démo »). Un délai n'est affiché au client que si minimum et maximum, ou la décomposition fournisseur / préparation / fabrication / transport, sont renseignés. Politique d'expédition multi-références : <strong>{settings?.shipmentPolicy === "SEPARATE" ? "séparée" : "groupée"}</strong> (Réglages).</p>
        <p className="mt-2 text-sm">{counts.map((c) => `${AVAIL_FR[c.availability]} : ${c._count}`).join(" · ")}</p>
      </Section>
      <Section title="Import contrôlé (CSV / JSON)">
        <p className="mb-3 text-sm text-stone-700">Colonnes : sku, availability (AVAILABLE | ON_ORDER | OUT_OF_STOCK | TO_CONFIRM), stockQty, leadMinDays, leadMaxDays, leadUnit, supplierDays, preparationDays, productionDays, transportDays, preorderAllowed, partialShipAllowed, leadSource, source (obligatoire). Aperçu sans écriture, doublons et références inconnues rejetés.</p>
        <StockImportForm />
      </Section>
      <Section title={`Références (${total})`}>
        <form className="mb-4 flex flex-wrap gap-2 items-end">
          <div><label className="label" htmlFor="famille">Famille</label><select id="famille" name="famille" defaultValue={famille} className="input"><option value="">Toutes</option>{families.map((f) => <option key={f.slug} value={f.slug}>{f.name}</option>)}</select></div>
          <div><label className="label" htmlFor="dispo">Disponibilité</label><select id="dispo" name="dispo" defaultValue={dispo} className="input"><option value="">Toutes</option><Options values={Object.keys(AVAIL_FR)} labels={AVAIL_FR} /></select></div>
          <div><label className="label" htmlFor="q">SKU</label><input id="q" name="q" defaultValue={q} className="input" /></div>
          <button className="btn-secondary" type="submit">Filtrer</button>
        </form>
        <ul className="space-y-3">
          {variants.map((v) => (
            <li key={v.id} className="rounded-lg border border-sand-200 p-3">
              <form action={updateStockAction} className="grid gap-2 text-sm md:grid-cols-6" aria-label={`Stock ${v.sku}`}>
                <input type="hidden" name="sku" value={v.sku} /><input type="hidden" name="returnTo" value={returnTo} />
                <p className="md:col-span-6"><span className="font-mono">{v.sku}</span> — {v.label} <span className="text-stone-700">· réservé {v.reservedQty} · mis à jour {fmtDate(v.leadUpdatedAt)}</span></p>
                <div><label className="label" htmlFor={`a-${v.id}`}>Disponibilité</label><select id={`a-${v.id}`} name="availability" defaultValue={v.availability} className={cell}><Options values={Object.keys(AVAIL_FR)} labels={AVAIL_FR} /></select></div>
                <div><label className="label" htmlFor={`q-${v.id}`}>Stock (si suivi)</label><input id={`q-${v.id}`} name="stockQty" type="number" min={0} defaultValue={v.stockQty ?? ""} className={cell} /><label className="mt-1 flex items-center gap-1 text-xs"><input type="checkbox" name="tracked" defaultChecked={v.stockMode === "STOCK"} /> stock suivi</label></div>
                <div><label className="label" htmlFor={`min-${v.id}`}>Délai min / max</label><div className="flex gap-1"><input id={`min-${v.id}`} name="leadMinDays" type="number" min={0} defaultValue={v.leadMinDays ?? ""} className={cell} aria-label="Délai minimum" /><input name="leadMaxDays" type="number" min={0} defaultValue={v.leadMaxDays ?? ""} className={cell} aria-label="Délai maximum" /></div></div>
                <div><label className="label" htmlFor={`u-${v.id}`}>Unité</label><select id={`u-${v.id}`} name="leadUnit" defaultValue={v.leadUnit} className={cell}><Options values={Object.keys(UNIT_FR)} labels={UNIT_FR} /></select></div>
                <div className="md:col-span-2"><label className="label">Fournisseur / préparation / fabrication / transport</label><div className="flex gap-1">{(["supplierDays", "preparationDays", "productionDays", "transportDays"] as const).map((k) => <input key={k} name={k} type="number" min={0} defaultValue={v[k] ?? ""} className={cell} aria-label={k} />)}</div></div>
                <div><label className="label" htmlFor={`s-${v.id}`}>Fiabilité</label><select id={`s-${v.id}`} name="leadSource" defaultValue={v.leadSource} className={cell}><Options values={Object.keys(DATA_STATUS_FR)} labels={DATA_STATUS_FR} /></select></div>
                <div className="md:col-span-2"><label className="label" htmlFor={`src-${v.id}`}>Origine de l'information</label><input id={`src-${v.id}`} name="stockSource" required defaultValue={v.stockSource || "démonstration (aucune source connectée)"} className={cell} /></div>
                <div className="flex flex-col justify-end gap-1 text-xs"><label className="flex items-center gap-1"><input type="checkbox" name="preorderAllowed" defaultChecked={v.preorderAllowed} /> précommande</label><label className="flex items-center gap-1"><input type="checkbox" name="partialShipAllowed" defaultChecked={v.partialShipAllowed} /> livraison partielle</label></div>
                <div className="flex items-end"><button className="btn-secondary py-1.5 min-h-0" type="submit">Enregistrer</button></div>
                {v.movements.length > 0 && <p className="md:col-span-6 text-xs text-stone-700">Mouvements : {v.movements.map((m) => `${m.delta > 0 ? "+" : ""}${m.delta} (${m.reason}, ${fmtDate(m.createdAt)})`).join(" · ")}</p>}
              </form>
            </li>
          ))}
        </ul>
        <div className="mt-4"><Pagination page={page} pages={Math.max(1, Math.ceil(total / PER_PAGE))} hrefFor={(p) => `/admin/catalogue/stocks?${new URLSearchParams({ ...params, page: String(p) })}`} /></div>
      </Section>
    </div>
  );
}
