/**
 * Propositions de prix (brouillons) et création d'un brouillon de grille depuis une proposition. Aucune publication :
 * la grille créée reste un brouillon de la lignée de vente, à vérifier et publier manuellement dans l'écran Tarifs.
 */
import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/server/audit";
import { cellForTotal } from "@/domain/market";
import { getGrid, restoreAsDraft, saveCells, type Actor } from "@/server/tariffs/grids";
import { MarketError } from "./policy";
import { study, type StudyInput, type StudyResult } from "./study";

export async function listProposals(familySlug?: string) {
  return prisma.marketPriceProposal.findMany({ where: familySlug ? { familySlug } : {}, orderBy: { createdAt: "desc" }, take: 100 });
}

/** Instantané d'une étude : montants, coûts manquants, comparables retenus (identifiants et prix), confiance. */
function snapshotOf(r: StudyResult) {
  return {
    sale: r.sale ? { totalMinor: r.sale.totalMinor, partial: r.sale.partial, lines: r.sale.lines, pending: r.sale.pending } : null,
    cost: r.cost ? { knownNetMinor: r.cost.knownNetMinor, prudentNetMinor: r.cost.prudentNetMinor, catalogueMinor: r.cost.catalogueMinor, lines: r.cost.lines, partial: r.cost.partial } : null,
    policy: r.policy ? { id: r.policy.id, version: r.policy.version, discountBps: r.policy.discountBps } : null,
    costs: r.costs,
    ours: r.ours,
    stats: r.stats,
    retained: r.evals.filter((e) => e.retained).map((e) => ({ id: e.obs.id, retailer: e.obs.retailer, url: e.obs.url, observedAt: e.obs.observedAt, comparableHtMinor: e.comparableHtMinor })),
    floor: r.floor,
    confidence: r.reco?.confidence ?? null,
    messages: r.reco?.messages ?? [],
  };
}

export async function createProposal(input: StudyInput & { scenario: string; proposedHtMinor: number; justification: string }, actor: Actor) {
  const r = await study(input);
  if ("error" in r) throw new MarketError(r.error ?? "Étude impossible.");
  if (!r.sim.price || !r.usedSale || r.vat == null) throw new MarketError("Aucune grille de vente en vigueur pour cette configuration : proposition impossible.");
  if (!Number.isInteger(input.proposedHtMinor) || input.proposedHtMinor <= 0) throw new MarketError("Prix proposé invalide.");
  if (r.floor?.floorHtMinor != null && input.proposedHtMinor < r.floor.floorHtMinor) throw new MarketError("Prix proposé sous le plancher : non enregistré. Revoyez les coûts, le périmètre ou le positionnement.");
  if (input.scenario === "premium" && !input.justification.trim()) throw new MarketError("Un scénario premium doit être justifié par des différences vérifiables.");
  const ttc = input.proposedHtMinor + Math.floor((input.proposedHtMinor * r.vat + 5_000) / 10_000);
  const p = await prisma.marketPriceProposal.create({
    data: {
      familySlug: input.familySlug, variantKey: r.sim.price.variantKey,
      config: { mounting: input.mounting, widthMm: input.widthMm, dimMm: input.dimMm, finishCode: input.finishCode ?? null, controlCode: input.controlCode ?? null, options: input.options ?? [], country: input.country, cell: r.sim.saleCell } as Prisma.InputJsonValue,
      priceListId: r.usedSale.id, priceListVersion: r.usedSale.version, policyVersionId: r.policy?.id ?? null, currentHtMinor: r.saleHt, proposedHtMinor: input.proposedHtMinor, proposedTtcMinor: ttc,
      scenario: input.scenario.slice(0, 40), snapshot: snapshotOf(r) as unknown as Prisma.InputJsonValue, justification: input.justification.slice(0, 2000), createdBy: actor.actorEmail ?? null,
    },
  });
  await audit({ ...actor, action: "market.proposal.create", entity: "MarketPriceProposal", entityId: p.id, after: { familySlug: p.familySlug, priceList: `v${p.priceListVersion}` } });
  return p;
}

export async function archiveProposal(id: string, actor: Actor) {
  const p = await prisma.marketPriceProposal.update({ where: { id }, data: { status: "ARCHIVED" } });
  await audit({ ...actor, action: "market.proposal.archive", entity: "MarketPriceProposal", entityId: id });
  return p;
}

/**
 * Brouillon de grille depuis une proposition : copie de la version de vente utilisée (« reprendre en brouillon ») puis
 * modification de la SEULE cellule de la configuration étudiée, de sorte que le total HT de cette configuration soit
 * le prix proposé (suppléments inchangés). Aucune extrapolation au reste de la grille ; aucune publication.
 */
export async function draftGridFromProposal(id: string, actor: Actor) {
  const p = await prisma.marketPriceProposal.findUnique({ where: { id } });
  if (!p || p.status !== "ACTIVE") throw new MarketError("Proposition introuvable ou archivée.");
  if (p.gridDraftId) throw new MarketError("Un brouillon de grille existe déjà pour cette proposition.");
  if (!p.priceListId) throw new MarketError("Proposition sans version tarifaire.");
  const base = await getGrid(p.priceListId);
  if (base.nature !== "SALE") throw new MarketError("La version liée n'est pas une grille de vente.");
  const snap = p.snapshot as { sale?: { lines: Array<{ code: string; amountMinor: number; detail?: string }> } };
  const lines = snap.sale?.lines ?? [];
  const cfg = p.config as { cell?: { dimAmm: number; widthMinMm: number; widthMaxMm: number } | null };
  if (!cfg.cell) throw new MarketError("Cellule de la configuration inconnue.");
  // suppléments : pourcentages (proportionnels à la cellule) et montants fixes, tels qu'enregistrés dans l'instantané
  const pct = lines.filter((l) => l.code !== "structure" && /% du prix de la structure/.test(l.detail ?? "")).map((l) => Math.round(Number((l.detail ?? "").replace(/\s/g, "").replace(",", ".").match(/^([\d.]+)%/)?.[1] ?? "0") * 100));
  const fixed = lines.filter((l) => l.code !== "structure" && !/% du prix de la structure/.test(l.detail ?? "")).reduce((a, l) => a + l.amountMinor, 0);
  const cell = cellForTotal(p.proposedHtMinor, fixed, pct);
  if (cell <= 0) throw new MarketError("Prix proposé inférieur aux suppléments de la configuration.");
  const draft = await restoreAsDraft(base.id, actor);
  const value = (cell / 100).toFixed(2).replace(".", ",");
  await saveCells(draft.id, draft.revision, [{ dimAmm: cfg.cell.dimAmm, widthMinMm: cfg.cell.widthMinMm, widthMaxMm: cfg.cell.widthMaxMm, action: "set", value }], actor);
  await prisma.supplierPriceList.update({ where: { id: draft.id }, data: { notes: [`Brouillon préparé depuis le comparatif marché (proposition ${p.id}) : une seule cellule modifiée (${cfg.cell.dimAmm} × ${cfg.cell.widthMinMm === cfg.cell.widthMaxMm ? cfg.cell.widthMaxMm : `${cfg.cell.widthMinMm}–${cfg.cell.widthMaxMm}`} mm). Publication manuelle.`, base.notes].filter(Boolean).join("\n") } });
  await prisma.marketPriceProposal.update({ where: { id }, data: { gridDraftId: draft.id } });
  await audit({ ...actor, action: "market.proposal.gridDraft", entity: "MarketPriceProposal", entityId: id, after: { gridDraftId: draft.id, basedOn: `${base.sourceKey} v${base.version}` } });
  return { draftId: draft.id, version: draft.version, cellMinor: cell };
}
