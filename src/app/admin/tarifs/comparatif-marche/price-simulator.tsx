"use client";
import { useState } from "react";
import { contributionOf, marginOf, type DirectCostInput } from "@/domain/market";
import { applyBpsHalfUp } from "@/domain/system-pricing";
import { eur, pctFr } from "./labels";

/** Simulation instantanée d'un prix HT : marge et contribution recalculées dans le navigateur (aucun enregistrement). */
export function PriceSimulator(p: { initialHtMinor: number | null; knownCostMinor: number; prudentCostMinor: number; costPartial: boolean; vatRateBps: number; costs: DirectCostInput[]; floorHtMinor: number | null; currentHtMinor: number | null }) {
  const [v, setV] = useState(p.initialHtMinor != null ? (p.initialHtMinor / 100).toFixed(2).replace(".", ",") : "");
  const t = v.replace(/[\s  €]/g, "").replace(",", ".");
  const ht = /^\d{1,9}(\.\d{1,2})?$/.test(t) ? Math.round(Number(t) * 100) : null;
  const ttc = ht != null ? ht + applyBpsHalfUp(ht, p.vatRateBps) : null;
  const known = ht != null ? marginOf(ht, p.knownCostMinor) : null;
  const prudent = ht != null ? marginOf(ht, p.prudentCostMinor) : null;
  const contrib = ht != null && ttc != null ? contributionOf(ht, ttc, { netMinor: p.prudentCostMinor, partial: p.costPartial }, p.costs) : null;
  return (
    <div className="space-y-2 text-sm" data-testid="price-simulator">
      <label className="flex max-w-xs flex-col">Prix de vente simulé HT (€)<input className="input" inputMode="decimal" name="simule" value={v} onChange={(e) => setV(e.target.value)} data-testid="sim-price-input" /></label>
      {ht == null ? <p className="text-stone-700">Saisissez un montant.</p> : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4" data-testid="sim-price-result">
          <dt>TTC</dt><dd>{eur(ttc)}</dd>
          <dt>Variation / prix actuel</dt><dd>{p.currentHtMinor ? `${ht >= p.currentHtMinor ? "+" : ""}${eur(ht - p.currentHtMinor)} (${pctFr(Math.round(((ht - p.currentHtMinor) * 10_000) / p.currentHtMinor))})` : "—"}</dd>
          <dt>Marge brute (coûts établis)</dt><dd data-testid="sim-margin">{eur(known!.grossMinor)} · {pctFr(known!.onPriceBps)} du prix · {pctFr(known!.onCostBps)} du coût</dd>
          <dt>Marge brute (hypothèse prudente)</dt><dd>{eur(prudent!.grossMinor)} · {pctFr(prudent!.onPriceBps)}</dd>
          <dt>Contribution estimée{contrib!.partial ? " (partielle)" : ""}</dt><dd>{eur(contrib!.contributionMinor)} · {pctFr(contrib!.onPriceBps)}</dd>
          <dt>Plancher</dt><dd>{p.floorHtMinor == null ? "non défini" : ht < p.floorHtMinor ? <strong className="text-danger">sous le plancher ({eur(p.floorHtMinor)})</strong> : `respecté (${eur(p.floorHtMinor)})`}</dd>
        </dl>
      )}
    </div>
  );
}
