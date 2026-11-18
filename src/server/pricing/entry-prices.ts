/**
 * Prix d'appel publics (« à partir de … € TTC ») : configuration réelle la moins chère calculée par le moteur de la
 * boutique sur la version publiée des grilles (src/domain/entry-price.ts). Recalculés à chaque nouvelle version du
 * catalogue (publication d'un tarif) ; aucun montant saisi dans les composants.
 */
import "server-only";
import { entryPrice, type EntryPrice } from "@/domain/entry-price";
import { configuratorHref } from "@/domain/categories";
import { loadCatalog } from "@/server/catalog/load";

let cache: { version: string; map: Map<string, EntryPrice | null> } | null = null;

export async function entryPriceFor(familySlug: string): Promise<EntryPrice | null> {
  const catalog = await loadCatalog();
  if (!cache || cache.version !== catalog.version) cache = { version: catalog.version, map: new Map() };
  if (!cache.map.has(familySlug)) cache.map.set(familySlug, entryPrice(catalog, familySlug));
  return cache.map.get(familySlug) ?? null;
}

/** Données publiques du prix d'appel : montants, configuration décrite, éléments manquants (libellés seulement). */
export interface PublicEntry {
  complete: boolean;
  ttcMinor: number | null;
  htMinor: number;
  currency: string;
  dims: string;
  mounting: string;
  equipment: string[];
  missing: string[];
  /** configurateur ouvert sur cette configuration */
  href: string;
}

export function publicEntry(e: EntryPrice | null): PublicEntry | null {
  if (!e) return null;
  return { complete: e.complete, ttcMinor: e.entry.ttcMinor, htMinor: e.entry.htMinor, currency: e.currency, dims: e.summary.dims, mounting: e.summary.mounting, equipment: e.summary.equipment, missing: e.missing.map((p) => p.label), href: `${configuratorHref(e.familySlug)}?depart=1` };
}

/** Prix « à partir de » : seulement une configuration complète, en TTC (prix public des particuliers en France). */
export function fromPriceOf(e: EntryPrice | null): { amountMinor: number; currency: string; taxBasis: "TTC"; htMinor: number } | null {
  return e?.complete && e.entry.ttcMinor != null ? { amountMinor: e.entry.ttcMinor, currency: e.currency, taxBasis: "TTC", htMinor: e.entry.htMinor } : null;
}
