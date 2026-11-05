import { StatusBadge } from "@/components/admin/ui";
import { formatEur } from "@/domain/money";

export const eur = (m: number | null | undefined) => (m == null ? "—" : formatEur(m, { showCents: m % 100 !== 0 }));
export const pctFr = (bps: number | null | undefined) => (bps == null ? "—" : `${(bps / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`);
export const MOUNTING_OBS_FR: Record<string, string> = { freestanding: "autoportante", wall: "adossée", unknown: "non indiquée" };
export const PRICE_KIND_FR: Record<string, string> = { configured: "configuration précise", fixed_size: "taille fixe affichée", from: "« à partir de »" };

export function ComparabilityBadge({ value }: { value: string }) {
  return <StatusBadge tone={value === "STRONG" ? "ok" : value === "PARTIAL" ? "warn" : "err"}>{value === "STRONG" ? "forte" : value === "PARTIAL" ? "partielle" : "insuffisante"}</StatusBadge>;
}

/** Bandeau : donnée interne, aucun effet sur les prix publics. */
export function MarketNote() {
  return <p role="note" className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger" data-testid="market-note">Données internes : coûts d'achat, marges, relevés concurrents et recommandations. Réservé aux administrateurs ; jamais affiché sur le site ni dans les documents clients. Aucune action de cette page ne modifie un prix public : une proposition crée au plus un brouillon de grille, publié manuellement dans Tarifs.</p>;
}

export function SubNav({ current }: { current: "etude" | "releves" | "politique" }) {
  const items = [["etude", "/admin/tarifs/comparatif-marche", "Étude d'une configuration"], ["releves", "/admin/tarifs/comparatif-marche/releves", "Relevés concurrents"], ["politique", "/admin/tarifs/comparatif-marche/politique", "Politique de coût (remise, coûts, objectifs)"]] as const;
  return <nav aria-label="Comparatif marché" className="flex flex-wrap gap-2 text-sm">{items.map(([k, href, label]) => <a key={k} href={href} className={k === current ? "btn-secondary min-h-0 py-1" : "btn-ghost min-h-0 py-1"} aria-current={k === current ? "page" : undefined}>{label}</a>)}</nav>;
}
