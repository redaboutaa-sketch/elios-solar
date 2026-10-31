/**
 * Moteur de configuration et de prix — pur, déterministe, sans accès base.
 * Le même code sert le configurateur (aperçu), le panier, le devis et la commande
 * (calcul autoritaire côté serveur).
 */
import { allSegments, layoutForFamily, segmentLabel } from "./layout";
import { applyBps, taxIncludedIn, type Cents } from "./money";
import { activeGridFor, priceFromGrid } from "./pricing-grid";
import { includedCablePublicText } from "./technical-spec";
import { evaluateSystemRules, MOUNTING_FR, type SystemInput } from "./system";
import { lookupSystemPrice, pricedSizes, type SystemPrice } from "./system-pricing";
import type {
  AccessoryStandaloneInput,
  AwningInput,
  CatalogSnapshot,
  ClosureCompatRule,
  CompatStatus,
  ConfigurationInput,
  DataStatus,
  EvaluationResult,
  Family,
  Issue,
  Layout,
  Mounting,
  OptionCompatRule,
  PergolaCustomInput,
  PergolaStandardInput,
  PriceLine,
  Promotion,
  ShippingRule,
  Totals,
  Variant,
} from "./types";

export const ENGINE_VERSION = "1.4.0";

/* ------------------------------------------------------------------ */
/* Utilitaires catalogue                                               */
/* ------------------------------------------------------------------ */

export function findFamily(catalog: CatalogSnapshot, slug: string): Family | undefined {
  return catalog.families.find((f) => f.slug === slug);
}

export function variantsOf(catalog: CatalogSnapshot, familySlug: string): Variant[] {
  return catalog.variants.filter((v) => v.familySlug === familySlug);
}

function matchWild<T>(ruleValue: T | "*", actual: T | undefined): boolean {
  return ruleValue === "*" || ruleValue === actual;
}

/** Choisit la règle la plus spécifique (nombre de champs non-joker). */
export function resolveClosureRule(
  catalog: CatalogSnapshot,
  q: { closureFamilySlug: string; pergolaFamilySlug: string; segmentLengthMm: number; finishCode: string; mounting: Mounting },
): ClosureCompatRule | undefined {
  let best: { rule: ClosureCompatRule; score: number } | undefined;
  for (const rule of catalog.closureCompat) {
    if (rule.closureFamilySlug !== q.closureFamilySlug) continue;
    if (!matchWild(rule.pergolaFamilySlug, q.pergolaFamilySlug)) continue;
    if (!matchWild(rule.segmentLengthMm, q.segmentLengthMm)) continue;
    if (!matchWild(rule.pergolaFinishCode, q.finishCode)) continue;
    if (!matchWild(rule.mounting, q.mounting)) continue;
    const score =
      (rule.pergolaFamilySlug !== "*" ? 1 : 0) +
      (rule.segmentLengthMm !== "*" ? 1 : 0) +
      (rule.pergolaFinishCode !== "*" ? 1 : 0) +
      (rule.mounting !== "*" ? 1 : 0);
    if (!best || score > best.score) best = { rule, score };
  }
  return best?.rule;
}

export function resolveOptionRule(
  catalog: CatalogSnapshot,
  q: { optionFamilySlug: string; pergolaFamilySlug: string },
): OptionCompatRule | undefined {
  let best: { rule: OptionCompatRule; score: number } | undefined;
  for (const rule of catalog.optionCompat) {
    if (rule.optionFamilySlug !== q.optionFamilySlug) continue;
    if (!matchWild(rule.pergolaFamilySlug, q.pergolaFamilySlug)) continue;
    const score = rule.pergolaFamilySlug !== "*" ? 1 : 0;
    if (!best || score > best.score) best = { rule, score };
  }
  return best?.rule;
}

function worst(a: DataStatus, b: DataStatus): DataStatus {
  const order: DataStatus[] = ["supplier_verified", "observed", "demo", "unknown"];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

/* ------------------------------------------------------------------ */
/* Aide à la construction                                              */
/* ------------------------------------------------------------------ */

class Builder {
  lines: PriceLine[] = [];
  issues: Issue[] = [];
  quoteRecommended = false;

  constructor(readonly catalog: CatalogSnapshot) {}

  issue(i: Issue) {
    this.issues.push(i);
    if (i.quoteSuggested) this.quoteRecommended = true;
  }

  line(l: Omit<PriceLine, "totalGrossCents">) {
    this.lines.push({ ...l, totalGrossCents: l.included ? 0 : l.unitGrossCents * l.qty });
  }

  get blocked(): boolean {
    return this.issues.some((i) => i.severity === "blocking" || i.severity === "review");
  }
}

/** Référence en rupture sans précommande : achat bloqué, devis proposé. Jamais d'estimation inventée. */
function checkAvailability(b: Builder, v: Variant, label: string, path?: string) {
  if (v.availability === "out_of_stock" && !v.preorderAllowed) {
    b.issue({ code: "variant_out_of_stock", severity: "blocking", message: `${label} : référence en rupture, sans précommande possible. Demandez un devis ou choisissez une autre référence.`, path, quoteSuggested: true });
    return false;
  }
  if (v.availability === "to_confirm") {
    b.issue({ code: "availability_to_confirm", severity: "info", message: `${label} : disponibilité et délai à confirmer par le fournisseur.`, path });
  }
  return true;
}

function applyPromotions(b: Builder, code: string | undefined, now: Date) {
  const promos = b.catalog.promotions.filter((p) => {
    if (!p.active) return false;
    if (p.startsAt && new Date(p.startsAt) > now) return false;
    if (p.endsAt && new Date(p.endsAt) < now) return false;
    const isAutomatic = !p.code;
    return isAutomatic || (code && p.code.toUpperCase() === code.toUpperCase());
  });
  if (code && !promos.some((p) => p.code.toUpperCase() === code.toUpperCase())) {
    b.issue({ code: "promotion_invalid", severity: "info", message: `Le code promotionnel « ${code} » n'est pas valide ou plus actif.` });
  }
  for (const promo of promos) applyPromotion(b, promo);
}

function applyPromotion(b: Builder, promo: Promotion) {
  const eligible = b.lines.filter(
    (l) =>
      (l.kind === "base" || l.kind === "closure" || l.kind === "option") &&
      !l.included &&
      (promo.familySlugs === "*" || promo.familySlugs.includes(familyOfLine(l))),
  );
  const base = eligible.reduce((s, l) => s + l.totalGrossCents, 0);
  if (base <= 0) return;
  const discount = applyBps(base, promo.percentBps);
  if (discount <= 0) return;
  b.lines.push({
    kind: "discount",
    code: `promo:${promo.code || "auto"}`,
    label: promo.label,
    qty: 1,
    unitGrossCents: -discount,
    totalGrossCents: -discount,
    taxRateBps: b.catalog.taxRateBps,
    dataStatus: "supplier_verified",
  });
}

function familyOfLine(l: PriceLine): string {
  // code = "<kind>:<familySlug>[:...]"
  return l.code.split(":")[1] ?? "";
}

/** Résolution de la règle de livraison (utilisée aussi au niveau panier). */
export function resolveShipping(catalog: CatalogSnapshot, delivery: { countryCode: string; postalCode?: string }): { status: "ok"; rule: ShippingRule } | { status: "postal_code_required" } | { status: "quote"; rule: ShippingRule } | { status: "unsupported" } {
  const rules = catalog.shippingRules.filter((r) => r.countryCode === delivery.countryCode.toUpperCase());
  if (rules.length === 0) return { status: "unsupported" };
  if (!delivery.postalCode) return { status: "postal_code_required" };
  const pc = delivery.postalCode.replace(/\s+/g, "");
  const specific = rules.find((r) => r.postalPrefixes.some((p) => pc.startsWith(p)));
  const rule = specific ?? rules.find((r) => r.postalPrefixes.length === 0);
  if (!rule) return { status: "unsupported" };
  if (rule.quoteRequired) return { status: "quote", rule };
  return { status: "ok", rule };
}

function shipping(b: Builder, delivery: { countryCode: string; postalCode?: string }): Cents | null {
  const rules = b.catalog.shippingRules.filter((r) => r.countryCode === delivery.countryCode.toUpperCase());
  if (rules.length === 0) {
    b.issue({ code: "shipping_country_unsupported", severity: "blocking", message: "Livraison non proposée dans ce pays. Demandez un devis.", quoteSuggested: true, path: "delivery" });
    return null;
  }
  if (!delivery.postalCode) {
    b.issue({ code: "shipping_postal_code_required", severity: "info", message: "Indiquez votre code postal pour connaître les frais de livraison et le total définitif.", path: "delivery.postalCode" });
    return null;
  }
  const pc = delivery.postalCode.replace(/\s+/g, "");
  const specific = rules.find((r) => r.postalPrefixes.some((p) => pc.startsWith(p)));
  const rule = specific ?? rules.find((r) => r.postalPrefixes.length === 0);
  if (!rule) {
    b.issue({ code: "shipping_zone_unknown", severity: "blocking", message: "Zone de livraison non couverte : devis nécessaire.", quoteSuggested: true, path: "delivery.postalCode" });
    return null;
  }
  if (rule.quoteRequired) {
    b.issue({ code: "shipping_quote_required", severity: "review", message: `${rule.label} : la livraison fait l'objet d'un devis.`, quoteSuggested: true, path: "delivery.postalCode" });
    return null;
  }
  b.line({ kind: "shipping", code: `shipping:${rule.countryCode}`, label: rule.label, qty: 1, unitGrossCents: rule.priceCents, taxRateBps: b.catalog.taxRateBps, dataStatus: "demo" });
  return rule.priceCents;
}

function totals(b: Builder, shippingCents: Cents | null, final: boolean): Totals {
  const sum = (k: PriceLine["kind"]) => b.lines.filter((l) => l.kind === k).reduce((s, l) => s + l.totalGrossCents, 0);
  const goods = sum("base") + sum("closure") + sum("option");
  const installation = sum("installation");
  const discount = Math.abs(sum("discount"));
  const total = goods + installation + (shippingCents ?? 0) - discount;
  const tax = b.lines.reduce((s, l) => s + taxIncludedIn(l.totalGrossCents, l.taxRateBps), 0);
  return {
    goodsGrossCents: goods,
    installationGrossCents: installation,
    shippingGrossCents: shippingCents,
    discountGrossCents: discount,
    taxCents: tax,
    totalGrossCents: total,
    isFinal: final && shippingCents !== null,
    currency: "EUR",
  };
}

function finish(b: Builder, input: ConfigurationInput, layout: Layout | undefined, shippingCents: Cents | null, extraNotFinal = false): EvaluationResult {
  const containsDemoData = b.lines.some((l) => l.dataStatus === "demo");
  const purchasable = !b.blocked && !extraNotFinal && b.lines.some((l) => l.kind === "base" || l.kind === "closure" || l.kind === "option");
  return {
    engineVersion: ENGINE_VERSION,
    catalogVersion: b.catalog.version,
    input,
    layout,
    lines: b.lines,
    totals: totals(b, shippingCents, purchasable),
    issues: b.issues,
    containsDemoData,
    purchasable,
    quoteRecommended: b.quoteRecommended || !purchasable,
  };
}

/* ------------------------------------------------------------------ */
/* Pergola standard                                                    */
/* ------------------------------------------------------------------ */

function evaluatePergolaStandard(catalog: CatalogSnapshot, input: PergolaStandardInput, now: Date): EvaluationResult {
  const b = new Builder(catalog);
  const family = findFamily(catalog, input.familySlug);
  if (!family || family.kind !== "pergola_standard" || family.status === "archived") {
    b.issue({ code: "family_unknown", severity: "blocking", message: "Gamme inconnue ou retirée du catalogue.", path: "familySlug" });
    return finish(b, input, undefined, null);
  }
  if (family.status === "draft" || family.status === "quote_only") {
    b.issue({ code: "family_not_purchasable", severity: "review", message: `La gamme ${family.name} n'est disponible que sur devis pour le moment.`, quoteSuggested: true, path: "familySlug" });
  }
  if (!(family.mountings ?? []).includes(input.mounting)) {
    b.issue({ code: "mounting_unavailable", severity: "blocking", message: "Cette implantation n'est pas proposée pour cette gamme.", path: "mounting" });
  }
  const dim = catalog.dimensions.find((d) => d.code === input.dimensionCode);
  if (!dim || !(family.dimensionCodes ?? []).includes(input.dimensionCode)) {
    b.issue({ code: "dimension_unavailable", severity: "blocking", message: "Dimension non proposée pour cette gamme. Pour une autre taille, utilisez le sur-mesure.", path: "dimensionCode", quoteSuggested: true });
    return finish(b, input, undefined, null);
  }
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  if (!fin || !(family.finishCodes ?? []).includes(input.finishCode)) {
    b.issue({ code: "finish_unavailable", severity: "blocking", message: `Cette finition n'est pas proposée sur ${family.name}.`, path: "finishCode" });
    return finish(b, input, undefined, null);
  }

  const layout = layoutForFamily(family, dim.widthMm, dim.lengthMm, input.mounting);

  // Base
  const base = variantsOf(catalog, family.slug).find(
    (v) => v.attributes.kind === "pergola_standard" && v.attributes.finishCode === input.finishCode && v.attributes.dimensionCode === input.dimensionCode && v.attributes.mounting === input.mounting,
  );
  if (!base) {
    b.issue({ code: "variant_missing", severity: "blocking", message: "Cette combinaison gamme × dimension × finition × implantation n'existe pas au catalogue.", quoteSuggested: true });
    return finish(b, input, layout, null);
  }
  if (!base.purchasable) {
    b.issue({ code: "variant_not_purchasable", severity: "review", message: "Référence en attente de validation fournisseur : disponible sur devis.", quoteSuggested: true, path: "familySlug" });
  }
  checkAvailability(b, base, `${family.name} ${dim.label}`, "dimensionCode");
  b.line({
    kind: "base",
    code: `base:${family.slug}:${base.sku}`,
    label: `${family.name} ${dim.label} – ${fin.label} – ${input.mounting === "wall" ? "adossée" : "autoportée"}`,
    sku: base.sku,
    qty: 1,
    unitGrossCents: base.priceCents,
    taxRateBps: base.taxRateBps,
    dataStatus: base.dataStatus,
  });

  // Segments
  const segments = allSegments(layout);
  const segmentIds = new Set(segments.map((s) => s.id));
  let closureCount = 0;
  for (const [segmentId, choice] of Object.entries(input.segments)) {
    if (!choice) continue;
    const seg = segments.find((s) => s.id === segmentId);
    if (!seg) {
      b.issue({
        code: "segment_not_in_layout",
        severity: "review",
        message: `L'ouverture « ${segmentId} » n'existe plus avec la dimension ou l'implantation choisie : confirmez la suppression ou le report de la fermeture.`,
        path: `segments.${segmentId}`,
      });
      continue;
    }
    const closureFamily = findFamily(catalog, choice.closureFamilySlug);
    if (!closureFamily || closureFamily.kind !== "side_closure") {
      b.issue({ code: "closure_unknown", severity: "blocking", message: "Fermeture inconnue.", path: `segments.${segmentId}` });
      continue;
    }
    const rule = resolveClosureRule(catalog, {
      closureFamilySlug: closureFamily.slug,
      pergolaFamilySlug: family.slug,
      segmentLengthMm: seg.lengthMm,
      finishCode: input.finishCode,
      mounting: input.mounting,
    });
    const status: CompatStatus = rule?.status ?? "unknown";
    const label = `${closureFamily.name} – ${segmentLabel(seg, layout)} (${seg.lengthMm / 1000} m)`;
    if (status === "forbidden") {
      b.issue({ code: "closure_incompatible", severity: "blocking", message: `${label} : ${rule?.reason ?? "incompatible avec cette configuration."}`, path: `segments.${segmentId}` });
      continue;
    }
    if (status === "unknown") {
      b.issue({ code: "closure_compat_unknown", severity: "review", message: `${label} : compatibilité non confirmée par le fournisseur. Nous validons cet assemblage sur devis.`, path: `segments.${segmentId}`, quoteSuggested: true });
    }
    const variant = variantsOf(catalog, closureFamily.slug).find((v) => {
      if (v.attributes.kind !== "side_closure") return false;
      const a = v.attributes;
      if (a.sideLengthMm !== seg.lengthMm) return false;
      if (a.colorCode !== fin.structureColor) return false;
      if (choice.option && a.option !== choice.option) return false;
      if (!choice.option && a.option && variantsOf(catalog, closureFamily.slug).some((o) => o.attributes.kind === "side_closure" && o.attributes.option !== a.option)) return false;
      if (a.mounting && a.mounting !== input.mounting) return false;
      return true;
    });
    if (!variant) {
      b.issue({
        code: "closure_variant_missing",
        severity: "blocking",
        message: `${label} : aucune référence ${closureFamily.name} de ${seg.lengthMm / 1000} m en ${fin.label.toLowerCase()}${choice.option ? ` (${choice.option})` : ""} n'est disponible. Demandez un devis.`,
        path: `segments.${segmentId}`,
        quoteSuggested: true,
      });
      continue;
    }
    const ca = variant.attributes.kind === "side_closure" ? variant.attributes : undefined;
    if (ca?.assembly === "modular") {
      const detail = `assemblage de ${ca.modules ?? "plusieurs"} modules${ca.moduleLengthMm ? ` de ${ca.moduleLengthMm / 1000} m` : ""}${ca.intermediatePosts ? `, ${ca.intermediatePosts} poteau${ca.intermediatePosts > 1 ? "x" : ""} intermédiaire${ca.intermediatePosts > 1 ? "s" : ""}` : ""}${ca.usableWidthMm ? `, cote utile ${ca.usableWidthMm} mm` : ""}`;
      if (ca.validation !== "confirmed" || !variant.purchasable) {
        b.issue({ code: "closure_assembly_to_confirm", severity: "review", message: `${label} : ${detail} — assemblage non confirmé par le fournisseur, validé sur devis.`, path: `segments.${segmentId}`, quoteSuggested: true });
      } else {
        b.issue({ code: "closure_assembly_info", severity: "info", message: `${label} : ${detail}.`, path: `segments.${segmentId}` });
      }
    } else if (!variant.purchasable) {
      b.issue({ code: "closure_not_purchasable", severity: "review", message: `${label} : référence disponible sur devis uniquement.`, path: `segments.${segmentId}`, quoteSuggested: true });
    }
    if (ca?.usableWidthMm && ca.usableWidthMm > seg.lengthMm) {
      b.issue({ code: "closure_usable_width", severity: "blocking", message: `${label} : cote utile ${ca.usableWidthMm} mm supérieure à l'ouverture.`, path: `segments.${segmentId}` });
      continue;
    }
    if (!checkAvailability(b, variant, label, `segments.${segmentId}`)) continue;
    closureCount += 1;
    b.line({
      kind: "closure",
      code: `closure:${closureFamily.slug}:${variant.sku}`,
      label: `${variant.label} – ${segmentLabel(seg, layout)}`,
      sku: variant.sku,
      qty: 1,
      unitGrossCents: variant.priceCents,
      taxRateBps: variant.taxRateBps,
      path: `segments.${segmentId}`,
      dataStatus: worst(variant.dataStatus, rule?.dataStatus ?? "unknown"),
    });
  }
  void segmentIds;

  // Options
  input.options.forEach((opt, idx) => {
    const path = `options.${idx}`;
    if (!Number.isInteger(opt.qty) || opt.qty < 1) {
      b.issue({ code: "option_qty_invalid", severity: "blocking", message: "Quantité invalide.", path });
      return;
    }
    const optFamily = findFamily(catalog, opt.familySlug);
    if (!optFamily || optFamily.kind !== "option") {
      b.issue({ code: "option_unknown", severity: "blocking", message: "Option inconnue.", path });
      return;
    }
    const rule = resolveOptionRule(catalog, { optionFamilySlug: optFamily.slug, pergolaFamilySlug: family.slug });
    const status: CompatStatus = rule?.status ?? "unknown";
    if (status === "forbidden") {
      b.issue({ code: "option_incompatible", severity: "blocking", message: `${optFamily.name} : ${rule?.reason ?? "incompatible avec cette gamme."}`, path });
      return;
    }
    if (status === "unknown") {
      b.issue({ code: "option_compat_unknown", severity: "review", message: `${optFamily.name} : ${rule?.reason ?? "compatibilité non confirmée"} — validation sur devis.`, path, quoteSuggested: true });
    }
    if (rule?.maxQty && opt.qty > rule.maxQty) {
      b.issue({ code: "option_qty_exceeded", severity: "blocking", message: `${optFamily.name} : quantité maximale ${rule.maxQty}.`, path });
      return;
    }
    const candidates = variantsOf(catalog, optFamily.slug).filter((v) => {
      if (v.attributes.kind !== "option") return false;
      const a = v.attributes;
      if (a.dimensionCode && a.dimensionCode !== input.dimensionCode) return false;
      if (a.mounting && a.mounting !== input.mounting) return false;
      if (opt.variantOption && a.variantOption !== opt.variantOption) return false;
      return true;
    });
    const colored = candidates.filter((v) => v.attributes.kind === "option" && (!v.attributes.colorCode || v.attributes.colorCode === fin.structureColor));
    const variant = colored[0] ?? undefined;
    if (!variant) {
      const anyColor = candidates[0];
      b.issue({
        code: "option_variant_missing",
        severity: "blocking",
        message: anyColor
          ? `${optFamily.name} : non disponible en ${fin.label.toLowerCase()} pour ce choix.`
          : `${optFamily.name} : aucune référence pour cette dimension / implantation.`,
        path,
        quoteSuggested: true,
      });
      return;
    }
    if (rule?.includedInBase) {
      b.issue({ code: "option_already_included", severity: "info", message: `${optFamily.name} est déjà inclus dans ${family.name} : non facturé.`, path });
      b.lines.push({ kind: "option", code: `option:${optFamily.slug}:${variant.sku}`, label: `${variant.label} (inclus)`, sku: variant.sku, qty: 1, unitGrossCents: 0, totalGrossCents: 0, taxRateBps: variant.taxRateBps, included: true, path, dataStatus: variant.dataStatus });
      return;
    }
    if (!variant.purchasable) {
      b.issue({ code: "option_not_purchasable", severity: "review", message: `${optFamily.name} : référence disponible sur devis uniquement.`, path, quoteSuggested: true });
    }
    if (!checkAvailability(b, variant, optFamily.name, path)) return;
    b.line({ kind: "option", code: `option:${optFamily.slug}:${variant.sku}`, label: variant.label, sku: variant.sku, qty: opt.qty, unitGrossCents: variant.priceCents, taxRateBps: variant.taxRateBps, path, dataStatus: worst(variant.dataStatus, rule?.dataStatus ?? "unknown") });
  });

  // Éclairage inclus dans la gamme : une seule ligne « inclus » (avec la couleur choisie le cas échéant)
  if (family.lightingIncluded && family.lightingIncluded !== "none") {
    const chosen = b.lines.find((l) => l.kind === "option" && l.included && l.code.startsWith("option:"));
    const base = family.lightingIncluded === "gutter_led" ? "Éclairage LED de gouttière" : "Éclairage LED intégré aux lames";
    if (chosen) {
      chosen.label = `${base} (inclus) – ${chosen.label.replace(/\s*\(inclus\)$/, "")}`;
    } else {
      b.lines.splice(1, 0, { kind: "option", code: `included:${family.slug}:lighting`, label: `${base} (inclus)`, qty: 1, unitGrossCents: 0, totalGrossCents: 0, taxRateBps: catalog.taxRateBps, included: true, dataStatus: family.dataStatus });
    }
  }

  // Prérequis (information, jamais une validation structurelle)
  if (family.roof === "motorized" || input.options.some((o) => ["bandes-led", "lampe-chauffante"].includes(o.familySlug))) {
    b.issue({ code: "power_supply_required", severity: "info", message: "Une alimentation électrique 230 V à proximité est nécessaire (motorisation / éclairage / chauffage). Raccordement non inclus." });
  }
  b.issue({ code: "anchoring_notice", severity: "info", message: "Fixations et fondations non incluses ; la tenue structurelle dépend du support et doit être vérifiée sur site." });

  // Montage
  let installationUnknown = false;
  if (input.installation === "professional") {
    const baseRate = catalog.installationRates.find((r) => r.familySlug === family.slug && (r.dimensionCode === input.dimensionCode || !r.dimensionCode));
    if (!baseRate) {
      installationUnknown = true;
      b.issue({ code: "installation_quote", severity: "review", message: "Montage professionnel : tarif non défini pour cette configuration, chiffré sur devis.", quoteSuggested: true, path: "installation" });
    } else {
      b.line({ kind: "installation", code: `installation:${family.slug}`, label: `Montage professionnel – ${family.name} ${dim.label}`, qty: 1, unitGrossCents: baseRate.priceCents, taxRateBps: catalog.taxRateBps, dataStatus: baseRate.dataStatus });
      if (closureCount > 0) {
        const closureRate = catalog.installationRates.find((r) => r.familySlug === "side_closure");
        if (closureRate) {
          b.line({ kind: "installation", code: `installation:side_closure`, label: "Montage des fermetures latérales", qty: closureCount, unitGrossCents: closureRate.priceCents, taxRateBps: catalog.taxRateBps, dataStatus: closureRate.dataStatus });
        } else {
          installationUnknown = true;
          b.issue({ code: "installation_closure_quote", severity: "review", message: "Montage des fermetures latérales : chiffré sur devis.", quoteSuggested: true, path: "installation" });
        }
      }
    }
  }

  applyPromotions(b, input.promotionCode, now);
  const ship = shipping(b, input.delivery);
  return finish(b, input, layout, ship, installationUnknown);
}

/* ------------------------------------------------------------------ */
/* Sur-mesure                                                          */
/* ------------------------------------------------------------------ */

function evaluatePergolaCustom(catalog: CatalogSnapshot, input: PergolaCustomInput, now: Date): EvaluationResult {
  const b = new Builder(catalog);
  const c = catalog.custom;
  const family = findFamily(catalog, "pergola-sur-mesure") ?? catalog.families.find((f) => f.kind === "pergola_custom");
  const check = (label: string, v: number, r: { min: number; max: number; step: number }, path: string) => {
    if (!Number.isInteger(v) || v < r.min || v > r.max) {
      b.issue({ code: "custom_out_of_bounds", severity: "blocking", message: `${label} : entre ${r.min} et ${r.max} mm.`, path });
    } else if ((v - r.min) % r.step !== 0) {
      b.issue({ code: "custom_step", severity: "blocking", message: `${label} : par pas de ${r.step} mm à partir de ${r.min} mm.`, path });
    }
  };
  check("Largeur", input.widthMm, c.widthMm, "widthMm");
  check("Longueur", input.lengthMm, c.lengthMm, "lengthMm");
  check("Hauteur", input.heightMm, c.heightMm, "heightMm");
  const fin = catalog.finishes.find((f) => f.code === input.finishCode);
  if (!fin) b.issue({ code: "finish_unavailable", severity: "blocking", message: "Finition inconnue.", path: "finishCode" });
  const layout = b.issues.some((i) => i.severity === "blocking")
    ? undefined
    : (() => { try { return layoutForFamily({ slug: family?.slug ?? "pergola-sur-mesure", name: family?.name ?? "Sur mesure", kind: "pergola_custom", status: "quote_only", shortDescription: "", dataStatus: c.dataStatus, dividerThresholdMm: family?.dividerThresholdMm ?? 6000 }, input.widthMm, input.lengthMm, input.mounting); } catch { return undefined; } })();
  if (input.widthMm * input.lengthMm > 20_000_000) {
    b.issue({ code: "permit_notice", severity: "info", message: "Au-delà de 20 m² d'emprise, une autorisation d'urbanisme peut être nécessaire : vérifiez auprès de votre mairie." });
  }
  const blockingDims = b.issues.some((i) => i.severity === "blocking");

  // Parcours 1 : grille tarifaire publiée et active → configuration chiffrée
  const grid = activeGridFor(c.grids, family?.slug ?? "pergola-sur-mesure", now);
  const closureSlugs = Object.values(input.sides).filter((v): v is { closureFamilySlug: string } => !!v).map((v) => v.closureFamilySlug);
  const priced = grid && !blockingDims && fin ? priceFromGrid(grid, { widthMm: input.widthMm, lengthMm: input.lengthMm, heightMm: input.heightMm, mounting: input.mounting, finishCode: input.finishCode, closureSlugs, options: input.options.map((o) => ({ familySlug: o.familySlug, qty: o.qty })), now }) : null;
  if (priced && priced.status === "priced") {
    const label = `${family?.name ?? "Pergola sur mesure"} ${input.widthMm / 1000} × ${input.lengthMm / 1000} m, h ${input.heightMm / 1000} m – ${fin!.label} – ${input.mounting === "wall" ? "adossée" : "autoportée"}`;
    b.line({ kind: "base", code: `base:${family?.slug ?? "pergola-sur-mesure"}:grid:${grid!.id}`, label, qty: 1, unitGrossCents: priced.baseCents, taxRateBps: catalog.taxRateBps, dataStatus: grid!.dataStatus });
    for (const l of priced.lines) {
      const kind = l.code.startsWith("closure") ? "closure" : "option";
      b.line({ kind, code: `${kind}:${family?.slug ?? "pergola-sur-mesure"}:${l.code}`, label: l.label, qty: l.qty, unitGrossCents: l.cents, taxRateBps: catalog.taxRateBps, dataStatus: grid!.dataStatus });
    }
    for (const u of priced.unpriced) {
      const slug = u.split(":")[1] ?? u;
      b.issue({ code: "custom_item_unpriced", severity: "review", message: `${findFamily(catalog, slug)?.name ?? slug} : non tarifé dans la grille sur mesure — chiffré sur devis.`, quoteSuggested: true, path: u.startsWith("closure") ? "sides" : "options" });
    }
    const firm = grid!.dataStatus === "supplier_verified" && !grid!.isDemo && !c.quoteOnly;
    if (firm) {
      b.issue({ code: "custom_grid_price", severity: "info", message: `Prix calculé depuis la grille fournisseur « ${grid!.name} » v${grid!.version}.` });
    } else {
      b.issue({ code: "custom_estimate", severity: "review", message: grid!.isDemo || grid!.dataStatus !== "supplier_verified" ? `Estimation à partir d'une grille de démonstration (« ${grid!.name } » v${grid!.version}) : le prix ferme est établi sur devis.` : "Pergola sur mesure : le prix définitif est confirmé par devis.", quoteSuggested: true });
    }
    if (input.installation === "professional") {
      const rate = catalog.installationRates.find((r) => r.familySlug === (family?.slug ?? "pergola-sur-mesure") && !r.dimensionCode);
      if (rate) b.line({ kind: "installation", code: `installation:${family?.slug ?? "pergola-sur-mesure"}`, label: "Montage professionnel – pergola sur mesure", qty: 1, unitGrossCents: rate.priceCents, taxRateBps: catalog.taxRateBps, dataStatus: rate.dataStatus });
      else b.issue({ code: "installation_quote", severity: "review", message: "Montage professionnel : chiffré sur devis pour le sur mesure.", quoteSuggested: true, path: "installation" });
    }
    b.issue({ code: "anchoring_notice", severity: "info", message: "Fixations et fondations non incluses ; la tenue structurelle dépend du support et doit être vérifiée sur site." });
    const ship = firm ? shipping(b, input.delivery) : null;
    return finish(b, input, layout, ship, !firm);
  }

  // Parcours 2 : pas de grille, combinaison hors grille ou validation technique → devis, projet conservé
  if (priced) {
    b.issue({ code: `custom_grid_${priced.status}`, severity: "review", message: `${priced.message} Le projet complet est transmis pour devis.`, quoteSuggested: true });
  } else {
    b.issue({
      code: "custom_quote_only",
      severity: "review",
      message: c.quoteOnly && !grid
        ? "Pergola sur mesure : le prix est établi sur devis (aucune grille fournisseur validée). Aucun prix au m² n'est affiché."
        : "Pergola sur mesure : le prix définitif est confirmé par devis.",
      quoteSuggested: true,
    });
  }
  return finish(b, input, layout, null, true);
}

/* ------------------------------------------------------------------ */
/* Store banne                                                         */
/* ------------------------------------------------------------------ */

function evaluateAwning(catalog: CatalogSnapshot, input: AwningInput, now: Date): EvaluationResult {
  const b = new Builder(catalog);
  const family = findFamily(catalog, input.familySlug);
  if (!family || family.kind !== "awning" || family.status === "archived") {
    b.issue({ code: "family_unknown", severity: "blocking", message: "Gamme de store inconnue.", path: "familySlug" });
    return finish(b, input, undefined, null);
  }
  const variant = variantsOf(catalog, family.slug).find(
    (v) => v.attributes.kind === "awning" && v.attributes.widthMm === input.widthMm && v.attributes.projectionMm === input.projectionMm && v.attributes.cabinetColor === input.cabinetColor && v.attributes.fabricCode === input.fabricCode,
  );
  if (!variant) {
    b.issue({ code: "awning_variant_missing", severity: "blocking", message: "Cette combinaison largeur × avancée × coffre × toile n'est pas proposée. Seules les variantes réellement disponibles sont vendues ; pour une autre taille, demandez un devis.", quoteSuggested: true, path: "widthMm" });
    return finish(b, input, undefined, null);
  }
  if (!variant.purchasable) b.issue({ code: "variant_not_purchasable", severity: "review", message: "Référence en attente de validation fournisseur : disponible sur devis.", quoteSuggested: true });
  b.line({ kind: "base", code: `base:${family.slug}:${variant.sku}`, label: variant.label, sku: variant.sku, qty: 1, unitGrossCents: variant.priceCents, taxRateBps: variant.taxRateBps, dataStatus: variant.dataStatus });
  const bracketCount = input.widthMm >= 5000 ? 3 : 2;
  b.lines.push({ kind: "option", code: `included:${family.slug}:brackets`, label: `${bracketCount} supports de fixation ${input.bracketMount === "wall" ? "muraux" : "plafond"} (inclus)`, qty: bracketCount, unitGrossCents: 0, totalGrossCents: 0, taxRateBps: variant.taxRateBps, included: true, dataStatus: family.dataStatus });
  b.lines.push({ kind: "option", code: `included:${family.slug}:remote`, label: "Télécommande et éclairage LED intégré (inclus)", qty: 1, unitGrossCents: 0, totalGrossCents: 0, taxRateBps: variant.taxRateBps, included: true, dataStatus: family.dataStatus });
  const cableText = includedCablePublicText(family.technicalSpecs);
  if (cableText) {
    b.lines.push({ kind: "option", code: `included:${family.slug}:cable`, label: `Câble d'alimentation fourni, ${cableText} (inclus)`, qty: 1, unitGrossCents: 0, totalGrossCents: 0, taxRateBps: variant.taxRateBps, included: true, dataStatus: family.dataStatus });
  }
  checkAvailability(b, variant, variant.label, "widthMm");

  input.options.forEach((opt, idx) => {
    const path = `options.${idx}`;
    const optFamily = findFamily(catalog, opt.familySlug);
    if (!optFamily || optFamily.kind !== "option") { b.issue({ code: "option_unknown", severity: "blocking", message: "Option inconnue.", path }); return; }
    const rule = resolveOptionRule(catalog, { optionFamilySlug: optFamily.slug, pergolaFamilySlug: family.slug });
    if (!rule || rule.status === "unknown") { b.issue({ code: "option_compat_unknown", severity: "review", message: `${optFamily.name} : compatibilité non confirmée — devis.`, path, quoteSuggested: true }); }
    if (rule?.status === "forbidden") { b.issue({ code: "option_incompatible", severity: "blocking", message: `${optFamily.name} : ${rule.reason ?? "incompatible"}.`, path }); return; }
    const variant2 = variantsOf(catalog, optFamily.slug).find((v) => v.attributes.kind === "option" && (!opt.variantOption || v.attributes.variantOption === opt.variantOption) && (!v.attributes.colorCode || v.attributes.colorCode === input.cabinetColor));
    if (!variant2) { b.issue({ code: "option_variant_missing", severity: "blocking", message: `${optFamily.name} : référence indisponible pour ce coffre.`, path, quoteSuggested: true }); return; }
    const oa = variant2.attributes.kind === "option" ? variant2.attributes : undefined;
    if (oa?.cableRole === "extension") {
      const prereq = (oa.prerequisites ?? []).join(", ");
      b.issue({ code: "cable_extension_prerequisites", severity: oa.compatibleWith?.includes(family.slug) && rule?.status === "allowed" ? "info" : "review", message: `${variant2.label} : rallonge distincte du câble fourni${cableText ? ` (${cableText}, inclus)` : ""}${prereq ? ` — prérequis : ${prereq}` : ""}${rule?.status === "allowed" ? "." : " — compatibilité électrique non confirmée par le fournisseur : validée sur devis."}`, path, quoteSuggested: rule?.status !== "allowed" });
    }
    if (!variant2.purchasable) b.issue({ code: "option_not_purchasable", severity: "review", message: `${optFamily.name} : référence disponible sur devis uniquement.`, path, quoteSuggested: true });
    if (!checkAvailability(b, variant2, optFamily.name, path)) return;
    b.line({ kind: "option", code: `option:${optFamily.slug}:${variant2.sku}`, label: variant2.label, sku: variant2.sku, qty: Math.max(1, opt.qty), unitGrossCents: variant2.priceCents, taxRateBps: variant2.taxRateBps, path, dataStatus: variant2.dataStatus });
  });

  b.issue({ code: "power_supply_required", severity: "info", message: "Store motorisé : alimentation 230 V nécessaire. Fixations (chevilles/boulons) non incluses ; support porteur à vérifier (pas de pose directe sur plaque de plâtre)." });
  let installationUnknown = false;
  if (input.installation === "professional") {
    const rate = catalog.installationRates.find((r) => r.familySlug === family.slug);
    if (!rate) { installationUnknown = true; b.issue({ code: "installation_quote", severity: "review", message: "Montage professionnel chiffré sur devis.", quoteSuggested: true, path: "installation" }); }
    else b.line({ kind: "installation", code: `installation:${family.slug}`, label: "Montage professionnel du store banne", qty: 1, unitGrossCents: rate.priceCents, taxRateBps: catalog.taxRateBps, dataStatus: rate.dataStatus });
  }
  applyPromotions(b, input.promotionCode, now);
  const ship = shipping(b, input.delivery);
  return finish(b, input, undefined, ship, installationUnknown);
}

/* ------------------------------------------------------------------ */
/* Accessoire seul                                                     */
/* ------------------------------------------------------------------ */

function evaluateAccessory(catalog: CatalogSnapshot, input: AccessoryStandaloneInput, now: Date): EvaluationResult {
  const b = new Builder(catalog);
  const family = findFamily(catalog, input.familySlug);
  const variant = catalog.variants.find((v) => v.sku === input.sku && v.familySlug === input.familySlug);
  if (!family || !variant || !["side_closure", "option"].includes(family.kind)) {
    b.issue({ code: "accessory_unknown", severity: "blocking", message: "Accessoire inconnu.", path: "sku" });
    return finish(b, input, undefined, null);
  }
  if (!Number.isInteger(input.qty) || input.qty < 1 || input.qty > 20) {
    b.issue({ code: "qty_invalid", severity: "blocking", message: "Quantité invalide (1 à 20).", path: "qty" });
  }
  const target = input.target;
  const pergola = findFamily(catalog, target.pergolaFamilySlug);
  if (!pergola) {
    b.issue({ code: "target_unknown", severity: "blocking", message: "Indiquez la gamme de pergola sur laquelle cet accessoire sera installé.", path: "target.pergolaFamilySlug" });
    return finish(b, input, undefined, null);
  }
  const fin = target.finishCode ? catalog.finishes.find((f) => f.code === target.finishCode) : undefined;
  if (family.kind === "side_closure") {
    const a = variant.attributes.kind === "side_closure" ? variant.attributes : undefined;
    const segLen = target.segmentLengthMm ?? a?.sideLengthMm;
    const rule = resolveClosureRule(catalog, { closureFamilySlug: family.slug, pergolaFamilySlug: pergola.slug, segmentLengthMm: segLen ?? 0, finishCode: target.finishCode ?? "*", mounting: target.mounting ?? "freestanding" });
    const status = rule?.status ?? "unknown";
    if (status === "forbidden") { b.issue({ code: "closure_incompatible", severity: "blocking", message: rule?.reason ?? "Incompatible avec cette pergola.", path: "target" }); return finish(b, input, undefined, null); }
    if (status === "unknown") b.issue({ code: "closure_compat_unknown", severity: "review", message: "Compatibilité non confirmée pour cette pergola : nous validons sur devis.", path: "target", quoteSuggested: true });
    if (a && segLen && a.sideLengthMm !== segLen) b.issue({ code: "closure_length_mismatch", severity: "blocking", message: `Cette référence couvre un côté de ${a.sideLengthMm / 1000} m, pas ${segLen / 1000} m.`, path: "target.segmentLengthMm" });
    if (a && fin && a.colorCode !== fin.structureColor) b.issue({ code: "closure_color_mismatch", severity: "blocking", message: `Couleur ${a.colorCode} différente de la structure (${fin.structureColor}).`, path: "target.finishCode" });
    if (a?.mounting && target.mounting && a.mounting !== target.mounting) b.issue({ code: "closure_mounting_mismatch", severity: "blocking", message: "Kit prévu pour une autre implantation.", path: "target.mounting" });
  } else {
    const rule = resolveOptionRule(catalog, { optionFamilySlug: family.slug, pergolaFamilySlug: pergola.slug });
    const status = rule?.status ?? "unknown";
    if (status === "forbidden") { b.issue({ code: "option_incompatible", severity: "blocking", message: rule?.reason ?? "Incompatible.", path: "target" }); return finish(b, input, undefined, null); }
    if (status === "unknown") b.issue({ code: "option_compat_unknown", severity: "review", message: `${family.name} : compatibilité non confirmée avec ${pergola.name} — devis.`, path: "target", quoteSuggested: true });
    if (rule?.includedInBase) b.issue({ code: "option_already_included", severity: "info", message: `${family.name} est déjà inclus sur ${pergola.name} : vérifiez votre besoin avant d'acheter.`, path: "target" });
    const a = variant.attributes.kind === "option" ? variant.attributes : undefined;
    if (a?.dimensionCode && target.dimensionCode && a.dimensionCode !== target.dimensionCode) b.issue({ code: "option_dimension_mismatch", severity: "blocking", message: `Référence prévue pour ${a.dimensionCode}, pas ${target.dimensionCode}.`, path: "target.dimensionCode" });
    if (a?.mounting && target.mounting && a.mounting !== target.mounting) b.issue({ code: "option_mounting_mismatch", severity: "blocking", message: "Référence prévue pour une autre implantation.", path: "target.mounting" });
    if (a?.colorCode && fin && a.colorCode !== fin.structureColor) b.issue({ code: "option_color_mismatch", severity: "blocking", message: "Couleur différente de la structure.", path: "target.finishCode" });
  }
  if (!variant.purchasable) b.issue({ code: "variant_not_purchasable", severity: "review", message: "Référence disponible sur devis uniquement.", quoteSuggested: true });
  const acc = variant.attributes.kind === "side_closure" ? variant.attributes : undefined;
  if (acc?.assembly === "modular" && acc.validation !== "confirmed") b.issue({ code: "closure_assembly_to_confirm", severity: "review", message: `${variant.label} : assemblage de ${acc.modules ?? "plusieurs"} modules${acc.intermediatePosts ? ` avec ${acc.intermediatePosts} poteau(x) intermédiaire(s)` : ""} non confirmé par le fournisseur — validé sur devis.`, path: "sku", quoteSuggested: true });
  if (!checkAvailability(b, variant, variant.label, "sku")) return finish(b, input, undefined, null);
  b.line({ kind: family.kind === "side_closure" ? "closure" : "option", code: `${family.kind === "side_closure" ? "closure" : "option"}:${family.slug}:${variant.sku}`, label: variant.label, sku: variant.sku, qty: Math.max(1, input.qty), unitGrossCents: variant.priceCents, taxRateBps: variant.taxRateBps, dataStatus: variant.dataStatus });
  applyPromotions(b, input.promotionCode, now);
  const ship = shipping(b, input.delivery);
  return finish(b, input, undefined, ship);
}

/* ------------------------------------------------------------------ */
/* Systèmes à la cote (catalogue HELIOSTORES)                           */
/* ------------------------------------------------------------------ */

const SYSTEM_KINDS = new Set(["pergola_system", "screen_system", "awning_system", "roof_blind_system", "insect_screen_system"]);

/**
 * Système configurable à la cote : règles sourcées de la famille ; prix lu dans la grille publique (system-pricing.ts).
 * Une configuration entièrement tarifée (structure seule, sans option ni point à confirmer) peut être commandée en ligne ;
 * sinon la commande passe par un devis (options, pose, livraison, points à confirmer).
 * Une famille en brouillon (ex. système dont le classement reste à décider) n'est pas configurable publiquement.
 */
function evaluateSystem(catalog: CatalogSnapshot, input: SystemInput): EvaluationResult {
  const b = new Builder(catalog);
  const family = findFamily(catalog, input.familySlug);
  if (!family || !SYSTEM_KINDS.has(family.kind) || !family.systemRules) {
    b.issue({ code: "family_unknown", severity: "blocking", message: "Système inconnu.", path: "familySlug" });
    return { ...finish(b, input, undefined, null, true), priceMode: "quote" };
  }
  if (family.status === "archived" || family.status === "draft") {
    b.issue({ code: "family_unavailable", severity: "blocking", message: `${family.name} : système non proposé à la configuration (classement ou données en cours de validation).`, path: "familySlug" });
    return { ...finish(b, input, undefined, null, true), priceMode: "quote" };
  }
  const ev = evaluateSystemRules(family.systemRules, input, family.name);
  for (const i of ev.issues) b.issue(i);
  let layout: Layout | undefined;
  const rules = family.systemRules;
  if (rules.type === "pergola" && ev.geometry.depthMm != null && !b.issues.some((i) => i.severity === "blocking" && /^(widthMm|depthMm|mounting)$/.test(i.path ?? ""))) {
    // repère du layout : « largeur » du layout = projection (côtés gauche/droit), « longueur » = largeur le long du mur.
    // Aucun poteau intermédiaire automatique : ils sont une option dont la position est établie au devis.
    try {
      layout = layoutForFamily({ ...family, dividerThresholdMm: 1_000_000 }, ev.geometry.depthMm, input.widthMm, input.mounting === "wall" ? "wall" : "freestanding");
    } catch {
      layout = undefined;
    }
  }
  const blocked = b.issues.some((i) => i.severity === "blocking");
  // prix de la grille publique : seulement pour une cote sans blocage, couverte par la grille
  const lookup = blocked || input.sizeCode === "custom" ? null : lookupSystemPrice(family.systemPrices, rules, input);
  const systemPrice = lookup?.ok ? lookup.price : null;
  const reasons = onlineOrderBlockers(input, b.issues, systemPrice, blocked);
  const orderable = reasons.length === 0 && systemPrice != null;
  if (orderable) {
    // configuration entièrement tarifée : structure seule au prix de la grille ; TVA du catalogue ajoutée à un prix HT
    const net = systemPrice.amountMinor;
    const taxRateBps = systemPrice.vatRateBps ?? catalog.taxRateBps;
    const gross = systemPrice.taxBasis === "TTC" ? net : net + applyBps(net, taxRateBps);
    const dims = [fmtM(input.widthMm), input.depthMm != null && rules.dims.depth ? fmtM(input.depthMm) : input.heightMm != null && rules.dims.height ? fmtM(input.heightMm) : null].filter(Boolean).join(" × ");
    b.line({ kind: "base", code: `base:${family.slug}:grid:v${systemPrice.listVersion}`, label: `${family.name} — ${dims}, pose ${MOUNTING_FR[input.mounting]}`, qty: 1, unitGrossCents: gross, taxRateBps, dataStatus: family.dataStatus });
  }
  const issues = orderable ? b.issues.filter((i) => i.code !== "system_quote_only") : b.issues;
  b.issues.splice(0, b.issues.length, ...issues);
  const result = finish(b, input, layout, null, !orderable);
  return {
    ...result,
    containsDemoData: family.dataStatus === "demo",
    purchasable: orderable,
    quoteRecommended: !orderable,
    priceMode: "quote",
    recap: ev.recap,
    systemPrice,
    pricedSizes: lookup && !lookup.ok && lookup.reason === "out_of_grid" ? pricedSizes(family.systemPrices, rules, input) : null,
    onlineOrder: { ok: orderable, reasons },
  };
}

const fmtM = (mm: number) => `${(mm / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3 })} m`;

/**
 * Motifs pour lesquels une configuration de système ne peut pas être commandée en ligne : seule une configuration
 * entièrement tarifée l'est (prix de la grille pour la cote, aucune option, aucun point à confirmer, pas de pose).
 */
function onlineOrderBlockers(input: SystemInput, issues: Issue[], price: SystemPrice | null, blocked: boolean): string[] {
  const r: string[] = [];
  if (blocked) r.push("un point est à corriger dans la configuration");
  else if (!price) r.push("ces dimensions ne figurent pas dans la grille de prix");
  else if (price.currency !== "EUR" || !price.taxBasis) r.push("le prix de la grille n'a pas de devise ou de base fiscale établie");
  if (input.options.length) r.push("les options sont chiffrées au devis");
  if (input.installation === "professional") r.push("la pose professionnelle est chiffrée au devis");
  if (issues.some((i) => i.quoteSuggested && i.code !== "system_quote_only" && i.path !== "installation" && !/^options/.test(i.path ?? ""))) r.push("un choix est à confirmer au devis");
  return r;
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export function evaluate(catalog: CatalogSnapshot, input: ConfigurationInput, now: Date = new Date()): EvaluationResult {
  switch (input.kind) {
    case "pergola_standard":
      return evaluatePergolaStandard(catalog, input, now);
    case "pergola_custom":
      return evaluatePergolaCustom(catalog, input, now);
    case "awning":
      return evaluateAwning(catalog, input, now);
    case "accessory":
      return evaluateAccessory(catalog, input, now);
    case "system":
      return evaluateSystem(catalog, input);
    default: {
      const b = new Builder(catalog);
      b.issue({ code: "kind_unknown", severity: "blocking", message: "Type de configuration inconnu." });
      return finish(b, input, undefined, null);
    }
  }
}

/**
 * Revalidation d'une configuration sauvegardée avec un catalogue plus récent.
 * Retourne le nouveau résultat et la liste des différences à confirmer.
 */
export interface RevalidationDiff {
  priceChanged: boolean;
  previousTotalCents: Cents;
  newTotalCents: Cents;
  newIssues: Issue[];
  resolvedIssueCodes: string[];
  catalogChanged: boolean;
}

export function revalidate(catalog: CatalogSnapshot, previous: EvaluationResult, now: Date = new Date()): { result: EvaluationResult; diff: RevalidationDiff } {
  const result = evaluate(catalog, previous.input, now);
  const prevCodes = new Set(previous.issues.map((i) => `${i.code}|${i.path ?? ""}`));
  const newCodes = new Set(result.issues.map((i) => `${i.code}|${i.path ?? ""}`));
  const newIssues = result.issues.filter((i) => !prevCodes.has(`${i.code}|${i.path ?? ""}`) && i.severity !== "info");
  const resolvedIssueCodes = [...prevCodes].filter((c) => !newCodes.has(c)).map((c) => c.split("|")[0] ?? c);
  return {
    result,
    diff: {
      priceChanged: previous.totals.totalGrossCents !== result.totals.totalGrossCents,
      previousTotalCents: previous.totals.totalGrossCents,
      newTotalCents: result.totals.totalGrossCents,
      newIssues,
      resolvedIssueCodes,
      catalogChanged: previous.catalogVersion !== catalog.version,
    },
  };
}

/**
 * Adaptation d'une configuration standard lorsque la gamme, la dimension ou l'implantation
 * change : rien n'est supprimé silencieusement. Les choix de segments qui n'existent plus
 * sont conservés dans `pending` pour confirmation.
 */
export function adaptStandardInput(
  catalog: CatalogSnapshot,
  previous: PergolaStandardInput,
  change: Partial<Pick<PergolaStandardInput, "familySlug" | "dimensionCode" | "mounting" | "finishCode">>,
): { next: PergolaStandardInput; pending: Array<{ segmentId: string; choice: NonNullable<PergolaStandardInput["segments"][string]>; reason: string }> } {
  const next: PergolaStandardInput = { ...previous, ...change, segments: { ...previous.segments } };
  const family = findFamily(catalog, next.familySlug);
  const dim = catalog.dimensions.find((d) => d.code === next.dimensionCode);
  const pending: Array<{ segmentId: string; choice: NonNullable<PergolaStandardInput["segments"][string]>; reason: string }> = [];
  if (!family || !dim) return { next, pending };
  const layout = layoutForFamily(family, dim.widthMm, dim.lengthMm, next.mounting);
  const ids = new Set(allSegments(layout).map((s) => s.id));
  for (const [id, choice] of Object.entries(previous.segments)) {
    if (!choice) continue;
    if (!ids.has(id)) {
      pending.push({ segmentId: id, choice, reason: "L'ouverture n'existe plus avec cette dimension ou implantation." });
      delete next.segments[id];
    }
  }
  if (change.finishCode && family.finishCodes && !family.finishCodes.includes(change.finishCode)) {
    next.finishCode = family.finishCodes[0] ?? next.finishCode;
  }
  return { next, pending };
}
