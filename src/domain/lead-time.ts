/**
 * Disponibilité et délais par référence — fonctions pures partagées (fiche, configurateur,
 * panier, commande). Une estimation n'est affichée que si les données permettent de la calculer.
 */
import type { Availability, DataStatus, LeadUnit, Variant } from "./types";

export interface LeadRange {
  /** jours calendaires (approximation : 5 jours ouvrés ≈ 7 jours calendaires) */
  minDays: number;
  maxDays: number;
  unit: LeadUnit;
  /** valeurs dans l'unité d'origine */
  minRaw: number;
  maxRaw: number;
  source: DataStatus;
  /** calculé depuis la décomposition fournisseur/préparation/fabrication/transport */
  fromComponents: boolean;
}

export const AVAILABILITY_FR: Record<Availability, string> = {
  available: "Disponible",
  on_order: "Sur commande",
  out_of_stock: "Rupture",
  to_confirm: "Disponibilité à confirmer",
};

export const LEAD_UNIT_FR: Record<LeadUnit, string> = { business_days: "jours ouvrés", calendar_days: "jours", weeks: "semaines" };

export function toCalendarDays(v: number, unit: LeadUnit): number {
  if (unit === "weeks") return v * 7;
  if (unit === "business_days") return Math.ceil(v * 7 / 5);
  return v;
}

/** Fourchette de délai d'une référence, ou null si inconnue. */
export function leadRangeOf(v: Pick<Variant, "leadMinDays" | "leadMaxDays" | "leadUnit" | "leadSource" | "leadComponents" | "leadTimeDays" | "availability" | "dataStatus">): LeadRange | null {
  const unit: LeadUnit = v.leadUnit ?? "business_days";
  const c = v.leadComponents;
  const comps = c ? [c.supplier, c.preparation, c.production, c.transport].filter((x): x is number => typeof x === "number" && x >= 0) : [];
  if (comps.length > 0) {
    const sum = comps.reduce((a, b) => a + b, 0);
    const max = v.leadMaxDays != null && v.leadMaxDays >= sum ? v.leadMaxDays : sum;
    return { minRaw: sum, maxRaw: max, minDays: toCalendarDays(sum, unit), maxDays: toCalendarDays(max, unit), unit, source: v.leadSource ?? "unknown", fromComponents: true };
  }
  if (v.leadMinDays != null && v.leadMaxDays != null) {
    return { minRaw: v.leadMinDays, maxRaw: v.leadMaxDays, minDays: toCalendarDays(v.leadMinDays, unit), maxDays: toCalendarDays(v.leadMaxDays, unit), unit, source: v.leadSource ?? "unknown", fromComponents: false };
  }
  if (v.leadTimeDays != null) {
    return { minRaw: v.leadTimeDays, maxRaw: v.leadTimeDays, minDays: toCalendarDays(v.leadTimeDays, "calendar_days"), maxDays: toCalendarDays(v.leadTimeDays, "calendar_days"), unit: "calendar_days", source: v.leadSource ?? v.dataStatus, fromComponents: false };
  }
  return null;
}

export function formatLeadRange(r: LeadRange | null): string {
  if (!r) return "délai à confirmer";
  const u = LEAD_UNIT_FR[r.unit];
  return r.minRaw === r.maxRaw ? `${r.minRaw} ${u}` : `${r.minRaw} à ${r.maxRaw} ${u}`;
}

/* ------------------------------------------------------------------ */
/* Estimation de livraison d'une commande multi-références              */
/* ------------------------------------------------------------------ */

export interface ShipmentItem {
  sku: string;
  label: string;
  qty: number;
  availability: Availability;
  stockTracked: boolean;
  /** quantité disponible (stock − réservé) si suivie */
  availableQty?: number | null;
  preorderAllowed: boolean;
  partialShipAllowed: boolean;
  lead: LeadRange | null;
}

export type ShipmentPolicy = "GROUPED" | "SEPARATE";

export interface Shipment {
  skus: string[];
  labels: string[];
  minDays: number;
  maxDays: number;
  minDate: string; // ISO date
  maxDate: string;
  reason: string;
}

export interface DeliveryEstimate {
  status: "estimated" | "unknown" | "blocked";
  policy: ShipmentPolicy;
  explanation: string;
  shipments: Shipment[];
  unknown: Array<{ sku: string; label: string; reason: string }>;
  blocked: Array<{ sku: string; label: string; reason: string }>;
}

function addDays(d: Date, n: number): string {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** Délai effectif d'une ligne selon stock et disponibilité ; null = inconnu ; "blocked" = non livrable. */
export function itemLead(it: ShipmentItem): { kind: "lead"; minDays: number; maxDays: number; reason: string } | { kind: "unknown"; reason: string } | { kind: "blocked"; reason: string } {
  const inStock = it.stockTracked && it.availableQty != null && it.availableQty >= it.qty;
  if (it.availability === "to_confirm") return { kind: "unknown", reason: "disponibilité à confirmer par le fournisseur" };
  if (it.availability === "out_of_stock" || (it.stockTracked && it.availableQty != null && it.availableQty < it.qty)) {
    if (!it.preorderAllowed) return { kind: "blocked", reason: it.availability === "out_of_stock" ? "en rupture, précommande non proposée" : `stock insuffisant (${it.availableQty ?? 0} disponible)` };
    if (!it.lead) return { kind: "unknown", reason: "précommande : délai de réapprovisionnement non renseigné" };
    return { kind: "lead", minDays: it.lead.minDays, maxDays: it.lead.maxDays, reason: "précommande : délai de réapprovisionnement" };
  }
  if (it.availability === "available" && inStock) {
    const prep = it.lead && it.lead.fromComponents ? it.lead : null;
    if (prep) return { kind: "lead", minDays: prep.minDays, maxDays: prep.maxDays, reason: "en stock : préparation et transport" };
    return { kind: "lead", minDays: it.lead?.minDays ?? 2, maxDays: it.lead?.maxDays ?? 5, reason: it.lead ? "en stock" : "en stock : préparation et transport (valeur par défaut)" };
  }
  if (!it.lead) return { kind: "unknown", reason: "délai non renseigné" };
  return { kind: "lead", minDays: it.lead.minDays, maxDays: it.lead.maxDays, reason: it.availability === "on_order" ? "fabriqué ou commandé à la demande" : "délai indicatif" };
}

export function estimateDelivery(items: ShipmentItem[], policy: ShipmentPolicy, now: Date = new Date()): DeliveryEstimate {
  const unknown: DeliveryEstimate["unknown"] = [];
  const blocked: DeliveryEstimate["blocked"] = [];
  const leads: Array<{ it: ShipmentItem; minDays: number; maxDays: number; reason: string }> = [];
  for (const it of items) {
    const r = itemLead(it);
    if (r.kind === "blocked") blocked.push({ sku: it.sku, label: it.label, reason: r.reason });
    else if (r.kind === "unknown") unknown.push({ sku: it.sku, label: it.label, reason: r.reason });
    else leads.push({ it, ...r });
  }
  if (blocked.length) return { status: "blocked", policy, explanation: "Une référence n'est pas livrable en l'état.", shipments: [], unknown, blocked };
  if (unknown.length || leads.length === 0) return { status: "unknown", policy, explanation: "Estimation impossible : au moins une référence a un délai à confirmer. Nous vous informons par e-mail dès confirmation.", shipments: [], unknown, blocked };
  const shipments: Shipment[] = [];
  const canSeparate = policy === "SEPARATE" && leads.every((l) => l.it.partialShipAllowed);
  if (!canSeparate) {
    const minDays = Math.max(...leads.map((l) => l.minDays));
    const maxDays = Math.max(...leads.map((l) => l.maxDays));
    const longest = leads.reduce((a, b) => (b.maxDays > a.maxDays ? b : a));
    shipments.push({ skus: leads.map((l) => l.it.sku), labels: leads.map((l) => l.it.label), minDays, maxDays, minDate: addDays(now, minDays), maxDate: addDays(now, maxDays), reason: `expédition groupée : toutes les références partent ensemble dès que la plus longue est disponible (${longest.it.label} — ${longest.reason})` });
  } else {
    const groups = new Map<string, typeof leads>();
    for (const l of leads) {
      const k = `${l.minDays}-${l.maxDays}`;
      groups.set(k, [...(groups.get(k) ?? []), l]);
    }
    for (const g of groups.values()) {
      shipments.push({ skus: g.map((l) => l.it.sku), labels: g.map((l) => l.it.label), minDays: g[0]!.minDays, maxDays: g[0]!.maxDays, minDate: addDays(now, g[0]!.minDays), maxDate: addDays(now, g[0]!.maxDays), reason: g.map((l) => l.reason).filter((v, i, a) => a.indexOf(v) === i).join(" ; ") });
    }
    shipments.sort((a, b) => a.minDays - b.minDays);
  }
  const explanation = policy === "GROUPED"
    ? "Règle appliquée : expédition groupée — une seule livraison, au délai de la référence la plus longue."
    : canSeparate
      ? `Règle appliquée : expédition séparée — ${shipments.length} envoi(s), chaque référence part dès qu'elle est disponible.`
      : "Règle appliquée : expédition groupée (une référence n'autorise pas la livraison partielle).";
  return { status: "estimated", policy, explanation, shipments, unknown, blocked };
}

export function variantToShipmentItem(v: Variant, qty: number, availableQty: number | null | undefined, label = v.label): ShipmentItem {
  return {
    sku: v.sku,
    label,
    qty,
    availability: v.availability ?? "to_confirm",
    stockTracked: v.stockMode === "stock",
    availableQty,
    preorderAllowed: v.preorderAllowed ?? false,
    partialShipAllowed: v.partialShipAllowed ?? true,
    lead: leadRangeOf(v),
  };
}
