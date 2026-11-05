import { StatusBadge } from "@/components/admin/ui";
import { CLIENTELE_LABEL, EFFECTIVE_LABEL, NATURE_LABEL, type Clientele, type EffectiveState, type Nature } from "@/domain/tariffs";
import { COLUMN_FR } from "@/server/tariffs/grids";

export const STATE_TONE: Record<EffectiveState, "ok" | "warn" | "err" | "neutral"> = { draft: "warn", verified: "neutral", scheduled: "neutral", in_force: "ok", expired: "neutral", deactivated: "err", archived: "neutral", rejected: "err" };

export function StateBadge({ state }: { state: EffectiveState }) {
  return <StatusBadge tone={STATE_TONE[state]}>{EFFECTIVE_LABEL[state]}</StatusBadge>;
}

export function NatureBadge({ nature }: { nature: string }) {
  return <StatusBadge tone={nature === "UNKNOWN" ? "warn" : nature === "PURCHASE" ? "err" : "neutral"}>{NATURE_LABEL[nature as Nature] ?? nature}</StatusBadge>;
}

export function ContextBadges({ nature, currency, taxBasis, clientele }: { nature: string; currency: string | null; taxBasis: string; clientele: string }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <NatureBadge nature={nature} />
      <StatusBadge tone={currency ? "neutral" : "warn"}>{currency ?? "Devise ?"}</StatusBadge>
      <StatusBadge tone={taxBasis === "UNKNOWN" ? "warn" : "neutral"}>{taxBasis === "UNKNOWN" ? "HT/TTC ?" : taxBasis}</StatusBadge>
      <StatusBadge tone="neutral">{CLIENTELE_LABEL[clientele as Clientele] ?? clientele}</StatusBadge>
    </span>
  );
}

export const columnLabel = (role: string | null) => COLUMN_FR[role ?? ""] ?? role ?? "—";
export const variantLabel = (v: string) => (v ? v.replace(/-/g, " ") : "variante unique");

/** « 3,40 m », « 2,00–2,90 m » */
export const fmtMm = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} m`;
export const fmtWidth = (min: number, max: number) => (min === max ? fmtMm(max) : `${fmtMm(min)} – ${fmtMm(max)}`);

/** Bandeau de confidentialité des montants. */
export function ConfidentialNote() {
  return <p role="note" className="rounded-md border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger">Données confidentielles : coûts d'achat et grilles non publiées. Réservé aux administrateurs ; jamais affiché sur le site, dans les documents clients ni dans le journal.</p>;
}
