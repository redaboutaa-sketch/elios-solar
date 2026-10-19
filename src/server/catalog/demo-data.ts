/**
 * Catalogue de DÉMONSTRATION d'ELIOS SOLAR.
 *
 * Les familles, dimensions, finitions et compatibilités reproduisent la *structure*
 * observée sur la référence (docs/reference-audit.md). Les prix, noms de gammes et
 * textes sont des créations internes marquées `demo` : ils ne sont ni des tarifs
 * fournisseur ni ceux d'un concurrent. L'import fournisseur (scripts/import-catalogue.ts)
 * remplace ces données par des références `supplier_verified`.
 */
import type {
  CatalogSnapshot,
  ClosureCompatRule,
  DimensionPreset,
  Family,
  Finish,
  InstallationRate,
  Mounting,
  OptionCompatRule,
  PriceGridSnapshot,
  Promotion,
  ShippingRule,
  Variant,
} from "@/domain/types";

/* ------------------------------------------------------------------ */
/* Disponibilité et délais de DÉMONSTRATION (aucune source connectée)   */
/* ------------------------------------------------------------------ */

type LeadPreset = Pick<Variant, "availability" | "leadMinDays" | "leadMaxDays" | "leadUnit" | "leadSource" | "leadComponents" | "preorderAllowed" | "partialShipAllowed">;

/** Jeu de démonstration : jours ouvrés, décomposés fournisseur / préparation / fabrication / transport. */
export const LEAD_PRESETS: Record<"pergola" | "closure_made" | "closure_stock" | "option_stock" | "awning" | "to_confirm", LeadPreset> = {
  pergola: { availability: "on_order", leadUnit: "business_days", leadSource: "demo", leadComponents: { supplier: 0, preparation: 2, production: 15, transport: 5 }, leadMinDays: 22, leadMaxDays: 30, preorderAllowed: false, partialShipAllowed: false },
  closure_made: { availability: "on_order", leadUnit: "business_days", leadSource: "demo", leadComponents: { supplier: 10, preparation: 2, production: 10, transport: 5 }, leadMinDays: 27, leadMaxDays: 35, preorderAllowed: false, partialShipAllowed: true },
  closure_stock: { availability: "available", leadUnit: "business_days", leadSource: "demo", leadComponents: { supplier: 0, preparation: 2, production: 0, transport: 4 }, leadMinDays: 6, leadMaxDays: 8, preorderAllowed: true, partialShipAllowed: true },
  option_stock: { availability: "available", leadUnit: "business_days", leadSource: "demo", leadComponents: { supplier: 0, preparation: 1, production: 0, transport: 3 }, leadMinDays: 4, leadMaxDays: 6, preorderAllowed: true, partialShipAllowed: true },
  awning: { availability: "on_order", leadUnit: "business_days", leadSource: "demo", leadComponents: { supplier: 0, preparation: 2, production: 10, transport: 4 }, leadMinDays: 16, leadMaxDays: 22, preorderAllowed: false, partialShipAllowed: true },
  to_confirm: { availability: "to_confirm", leadUnit: "business_days", leadSource: "unknown", preorderAllowed: false, partialShipAllowed: true },
};

export const DEMO_CATALOG_VERSION = "demo-2026-10-19.2";

/* ------------------------------------------------------------------ */
/* Finitions & dimensions                                              */
/* ------------------------------------------------------------------ */

export const FINISHES: Finish[] = [
  { code: "ANTHRACITE", label: "Anthracite", structureColor: "ANTHRACITE", bladeColor: "ANTHRACITE", swatch: "#3a3d41" },
  { code: "WHITE", label: "Blanc", structureColor: "WHITE", bladeColor: "WHITE", swatch: "#f2f1ec" },
  { code: "ANTHRACITE_WHITE_BLADES", label: "Anthracite, lames blanches", structureColor: "ANTHRACITE", bladeColor: "WHITE", swatch: "linear-gradient(135deg,#3a3d41 50%,#f2f1ec 50%)" },
  { code: "BLACK", label: "Noir", structureColor: "BLACK", bladeColor: "BLACK", swatch: "#111214" },
];

export const DIMENSIONS: DimensionPreset[] = [
  { code: "3x3", label: "3 × 3 m", widthMm: 3000, lengthMm: 3000 },
  { code: "3x4", label: "3 × 4 m", widthMm: 3000, lengthMm: 4000 },
  { code: "3x5", label: "3 × 5 m", widthMm: 3000, lengthMm: 5000 },
  { code: "3x6", label: "3 × 6 m", widthMm: 3000, lengthMm: 6000 },
  { code: "4x4", label: "4 × 4 m", widthMm: 4000, lengthMm: 4000 },
  { code: "4x5", label: "4 × 5 m", widthMm: 4000, lengthMm: 5000 },
  { code: "4x6", label: "4 × 6 m", widthMm: 4000, lengthMm: 6000 },
];

const ALL_MOUNTINGS: Mounting[] = ["freestanding", "wall"];
const COLOR_LABEL: Record<string, string> = { ANTHRACITE: "anthracite", WHITE: "blanc", BLACK: "noir" };

/* ------------------------------------------------------------------ */
/* Familles                                                            */
/* ------------------------------------------------------------------ */

export interface FamilyContent {
  description: string;
  included: string[];
  faq: Array<{ q: string; a: string }>;
}

export const FAMILY_CONTENT: Record<string, FamilyContent> = {
  "pergola-solis": {
    description:
      "Pergola bioclimatique en aluminium à lames orientables manuelles. Sans moteur ni câblage : idéale lorsque l'alimentation électrique n'est pas disponible. Rails d'accessoires intégrés pour ajouter des fermetures latérales sans percer.",
    included: ["Structure aluminium thermolaquée", "Toit à lames orientables, commande manuelle", "Gouttières avec évacuation intégrée", "Notice de montage (à fournir)"],
    faq: [
      { q: "Faut-il une alimentation électrique ?", a: "Non pour la pergola elle-même. Les bandes LED ou la lampe chauffante en option nécessitent une prise 230 V à proximité." },
      { q: "Puis-je ajouter des parois plus tard ?", a: "Oui : les fermetures latérales s'achètent séparément après vérification de la compatibilité (gamme, dimension, finition)." },
    ],
  },
  "pergola-solis-pro": {
    description:
      "Pergola bioclimatique motorisée à lames double paroi, éclairage LED de gouttière à intensité variable inclus. Pilotage par télécommande. Deux rails d'accessoires par poutre.",
    included: ["Structure aluminium thermolaquée", "Toit à lames motorisé avec télécommande", "Éclairage LED de gouttière à intensité variable", "Gouttières avec évacuation intégrée"],
    faq: [{ q: "L'éclairage est-il inclus ?", a: "Oui, l'éclairage LED de gouttière est inclus : il n'est pas facturé une seconde fois si vous l'ajoutez au configurateur." }],
  },
  "pergola-solis-max": {
    description:
      "Notre pergola motorisée la plus aboutie : lames larges à éclairage intégré, profils renforcés et trois rails d'accessoires pour composer un véritable espace à vivre.",
    included: ["Structure aluminium renforcée", "Toit à lames larges motorisé avec télécommande", "Éclairage LED intégré aux lames", "Gouttières avec évacuation intégrée"],
    faq: [{ q: "Les grandes portées nécessitent-elles un poteau intermédiaire ?", a: "La règle fournisseur n'est pas encore confirmée pour cette gamme : les fermetures sur un côté de 6 m sont validées sur devis." }],
  },
  "pergola-sur-mesure": {
    description:
      "Pergola bioclimatique motorisée fabriquée à vos cotes : largeur, longueur et hauteur libres dans les bornes du fabricant, finitions au choix, fermetures latérales par côté. Chiffrage par devis.",
    included: ["Étude de faisabilité par notre équipe", "Devis détaillé sous 48 h ouvrées"],
    faq: [{ q: "Pourquoi n'y a-t-il pas de prix affiché ?", a: "La grille tarifaire sur mesure dépend du fournisseur et n'est pas encore validée : nous ne publions pas de prix au m² approximatif." }],
  },
  "store-banne-ombra": {
    description:
      "Store banne coffre intégral motorisé avec éclairage LED intégré et télécommande. Toile acrylique traitée anti-UV, supports muraux ou plafond au choix.",
    included: ["Coffre aluminium et bras articulés", "Moteur avec télécommande", "Éclairage LED intégré", "Supports muraux ou plafond (2 ou 3 selon largeur)"],
    faq: [{ q: "Quelles tailles sont disponibles ?", a: "Seules les combinaisons largeur × avancée réellement fabriquées sont proposées. Pour une autre cote, demandez un devis." }],
  },
  "paroi-vitree": { description: "Paroi en verre trempé, fixe ou coulissante, pour fermer un côté de pergola tout en conservant la lumière.", included: ["Panneaux de verre trempé", "Rails et profils assortis à la structure"], faq: [] },
  "persienne-aluminium": { description: "Panneau à lattes d'aluminium pour l'intimité et la protection contre le vent, kit adapté à l'implantation.", included: ["Panneau à lattes", "Kit de fixation selon implantation"], faq: [] },
  "store-vertical-zip": { description: "Store vertical à guidage ZIP, hauteur réglable, pour l'ombre et l'intimité ; toile résistante au vent modéré.", included: ["Coffre et coulisses", "Toile micro-perforée", "Manœuvre manuelle"], faq: [] },
  "bandes-led": { description: "Bandes LED à clipser dans les gouttières, blanc chaud ou RGB, intensité réglable.", included: ["Bandes LED pour les quatre gouttières", "Alimentation et télécommande"], faq: [] },
  "lampe-chauffante": { description: "Chauffage infrarouge à fixer sur la poutre, pour prolonger les soirées.", included: ["Lampe chauffante", "Support de fixation"], faq: [] },
  "lanterne-ambiance": { description: "Lanterne d'extérieur rechargeable, lumière chaude.", included: ["Lanterne", "Câble de charge"], faq: [] },
  "anemometre": { description: "Capteur de vent provoquant la rétraction automatique du store banne.", included: ["Capteur", "Pile"], faq: [] },
  "cable-alimentation": { description: "Câble d'alimentation du moteur de store banne. Le câble fourni avec le store est inclus ; une rallonge est une référence distincte dont la compatibilité électrique doit être confirmée par le fournisseur.", included: [], faq: [{ q: "Le câble est-il inclus ?", a: "Oui, un câble est livré avec le store (longueur indiquée sur la fiche). La rallonge 6 m est une option distincte, à confirmer." }] },
};

export const FAMILIES: Family[] = [
  {
    slug: "pergola-solis",
    name: "Pergola Solis",
    kind: "pergola_standard",
    status: "published",
    generation: "Série 1",
    shortDescription: "Lames orientables manuelles, sans électricité.",
    roof: "manual",
    lightingIncluded: "none",
    accessoryRails: 1,
    dividerThresholdMm: 6000,
    finishCodes: ["ANTHRACITE", "WHITE", "ANTHRACITE_WHITE_BLADES", "BLACK"],
    dimensionCodes: DIMENSIONS.map((d) => d.code),
    mountings: ALL_MOUNTINGS,
    specs: [
      { label: "Toit", value: "Lames orientables, manivelle", status: "demo" },
      { label: "Éclairage", value: "Non inclus (bandes LED en option)", status: "demo" },
      { label: "Rails d'accessoires", value: "1 par poutre", status: "demo" },
      { label: "Hauteur de passage", value: "À confirmer (fiche fournisseur)", status: "unknown" },
      { label: "Résistance vent / neige", value: "À confirmer (fiche fournisseur)", status: "unknown" },
    ],
    dataStatus: "demo",
  },
  {
    slug: "pergola-solis-pro",
    name: "Pergola Solis Pro",
    kind: "pergola_standard",
    status: "published",
    generation: "Série 1",
    shortDescription: "Toit motorisé, éclairage de gouttière inclus.",
    roof: "motorized",
    lightingIncluded: "gutter_led",
    accessoryRails: 2,
    dividerThresholdMm: 6000,
    finishCodes: ["ANTHRACITE", "WHITE", "ANTHRACITE_WHITE_BLADES", "BLACK"],
    dimensionCodes: DIMENSIONS.map((d) => d.code),
    mountings: ALL_MOUNTINGS,
    specs: [
      { label: "Toit", value: "Lames double paroi motorisées, télécommande", status: "demo" },
      { label: "Éclairage", value: "LED de gouttière à intensité variable, inclus", status: "demo" },
      { label: "Rails d'accessoires", value: "2 par poutre", status: "demo" },
      { label: "Hauteur de passage", value: "À confirmer (fiche fournisseur)", status: "unknown" },
      { label: "Résistance vent / neige", value: "À confirmer (fiche fournisseur)", status: "unknown" },
    ],
    dataStatus: "demo",
  },
  {
    slug: "pergola-solis-max",
    name: "Pergola Solis Max",
    kind: "pergola_standard",
    status: "published",
    generation: "Série 1",
    shortDescription: "Lames larges motorisées à éclairage intégré, profils renforcés.",
    roof: "motorized",
    lightingIncluded: "blade_led",
    accessoryRails: 3,
    dividerThresholdMm: 6000,
    finishCodes: ["ANTHRACITE", "WHITE", "ANTHRACITE_WHITE_BLADES"],
    dimensionCodes: DIMENSIONS.map((d) => d.code),
    mountings: ALL_MOUNTINGS,
    specs: [
      { label: "Toit", value: "Lames larges motorisées, télécommande", status: "demo" },
      { label: "Éclairage", value: "LED intégré aux lames, inclus", status: "demo" },
      { label: "Rails d'accessoires", value: "3 par poutre", status: "demo" },
      { label: "Poteau intermédiaire sur 6 m", value: "Règle fournisseur à confirmer", status: "unknown" },
      { label: "Résistance vent / neige", value: "À confirmer (fiche fournisseur)", status: "unknown" },
    ],
    dataStatus: "demo",
  },
  {
    slug: "pergola-sur-mesure",
    name: "Pergola sur mesure",
    kind: "pergola_custom",
    status: "quote_only",
    shortDescription: "Largeur, longueur et hauteur à vos cotes. Sur devis.",
    roof: "motorized",
    lightingIncluded: "gutter_led",
    dividerThresholdMm: 6000,
    finishCodes: ["ANTHRACITE", "WHITE", "ANTHRACITE_WHITE_BLADES"],
    mountings: ALL_MOUNTINGS,
    specs: [{ label: "Bornes dimensionnelles", value: "À confirmer par la fiche fournisseur", status: "unknown" }],
    dataStatus: "unknown",
  },
  {
    slug: "store-banne-ombra",
    name: "Store banne Ombra",
    kind: "awning",
    status: "published",
    shortDescription: "Coffre intégral motorisé, LED et télécommande incluses.",
    specs: [
      { label: "Largeurs", value: "2 à 6 m selon variantes", status: "demo" },
      { label: "Avancées", value: "1,5 à 3,5 m selon variantes", status: "demo" },
      { label: "Alimentation", value: "230 V, câble 3 m fourni (longueur à confirmer)", status: "demo" },
      { label: "Résistance au vent", value: "À confirmer (fiche fournisseur)", status: "unknown" },
    ],
    includedCableMm: 3000,
    dataStatus: "demo",
  },
  { slug: "paroi-vitree", name: "Paroi vitrée", kind: "side_closure", status: "published", shortDescription: "Fixe ou coulissante, verre trempé.", specs: [{ label: "Hauteur", value: "À confirmer", status: "unknown" }], dataStatus: "demo" },
  { slug: "persienne-aluminium", name: "Persienne aluminium", kind: "side_closure", status: "published", shortDescription: "Lattes aluminium, intimité et brise-vent.", specs: [], dataStatus: "demo" },
  { slug: "store-vertical-zip", name: "Store vertical ZIP", kind: "side_closure", status: "published", shortDescription: "Toile guidée ZIP, hauteur réglable.", specs: [], dataStatus: "demo" },
  { slug: "bandes-led", name: "Bandes LED", kind: "option", status: "published", shortDescription: "Blanc chaud ou RGB, à clipser dans les gouttières.", specs: [], dataStatus: "demo" },
  { slug: "lampe-chauffante", name: "Lampe chauffante", kind: "option", status: "published", shortDescription: "Infrarouge 1 500 W ou 2 000 W.", specs: [], dataStatus: "demo" },
  { slug: "lanterne-ambiance", name: "Lanterne d'ambiance", kind: "option", status: "published", shortDescription: "Lumière chaude rechargeable.", specs: [], dataStatus: "demo" },
  { slug: "anemometre", name: "Anémomètre", kind: "option", status: "published", shortDescription: "Rétraction automatique du store banne par vent fort.", specs: [], dataStatus: "demo" },
  { slug: "cable-alimentation", name: "Câble d'alimentation", kind: "option", status: "published", shortDescription: "Câble fourni avec le store ; rallonge 6 m à confirmer.", specs: [{ label: "Compatibilité électrique de la rallonge", value: "À confirmer (fiche fournisseur)", status: "unknown" }], dataStatus: "unknown" },
  { slug: "montage-professionnel", name: "Montage professionnel", kind: "service", status: "published", shortDescription: "Pose par un installateur partenaire (zones couvertes à confirmer).", specs: [], dataStatus: "demo" },
];

/* ------------------------------------------------------------------ */
/* Variantes (prix de démonstration)                                   */
/* ------------------------------------------------------------------ */

function round10(cents: number): number {
  return Math.round(cents / 1000) * 1000;
}

const PERGOLA_PRICING: Record<string, { fixedCents: number; perM2Cents: number; prefix: string }> = {
  "pergola-solis": { fixedCents: 190_000, perM2Cents: 19_000, prefix: "ES-PS1" },
  "pergola-solis-pro": { fixedCents: 260_000, perM2Cents: 24_000, prefix: "ES-PSP" },
  "pergola-solis-max": { fixedCents: 360_000, perM2Cents: 31_000, prefix: "ES-PSM" },
};

function pergolaVariants(): Variant[] {
  const out: Variant[] = [];
  for (const family of FAMILIES.filter((f) => f.kind === "pergola_standard")) {
    const p = PERGOLA_PRICING[family.slug]!;
    for (const dim of DIMENSIONS) {
      const area = (dim.widthMm / 1000) * (dim.lengthMm / 1000);
      const price = round10(p.fixedCents + p.perM2Cents * area);
      for (const finish of family.finishCodes ?? []) {
        for (const mounting of ALL_MOUNTINGS) {
          const fin = FINISHES.find((f) => f.code === finish)!;
          out.push({
            sku: `${p.prefix}-${dim.code.toUpperCase()}-${finish.slice(0, 3)}${finish === "ANTHRACITE_WHITE_BLADES" ? "W" : ""}-${mounting === "wall" ? "ADO" : "AUT"}`,
            familySlug: family.slug,
            label: `${family.name} ${dim.label} – ${fin.label} – ${mounting === "wall" ? "adossée" : "autoportée"}`,
            priceCents: price,
            compareAtCents: null,
            taxRateBps: 2000,
            purchasable: true,
            dataStatus: "demo",
            stockMode: "made_to_order",
            leadTimeDays: 21,
            ...LEAD_PRESETS.pergola,
            weightGrams: Math.round(area * 16_000),
            attributes: { kind: "pergola_standard", finishCode: finish, dimensionCode: dim.code, mounting },
          });
        }
      }
    }
  }
  return out;
}

const CLOSURE_LENGTHS = [3000, 4000, 5000, 6000];

function closureVariants(): Variant[] {
  const out: Variant[] = [];
  // Paroi vitrée : 3 options, 2 couleurs (pas de noir : comme observé), 4 longueurs
  const glassOptions = [
    // prix démo : fixe (€) + €/mm de longueur → 3 m ≈ 1 440 / 1 560 / 1 680 €, 6 m ≈ 2 580 / 2 820 / 3 060 €
    { code: "fixed", label: "fixe", perMm: 0.38, fixed: 300 },
    { code: "sliding_framed", label: "coulissante avec cadre", perMm: 0.42, fixed: 300 },
    { code: "sliding_frameless", label: "coulissante sans cadre", perMm: 0.46, fixed: 300 },
  ];
  for (const len of CLOSURE_LENGTHS) for (const color of ["ANTHRACITE", "WHITE"]) for (const opt of glassOptions) {
    out.push({
      sku: `ES-PV-${len / 1000}M-${color.slice(0, 3)}-${opt.code.toUpperCase().replace("SLIDING_", "")}`,
      familySlug: "paroi-vitree",
      label: `Paroi vitrée ${opt.label} ${len / 1000} m – ${COLOR_LABEL[color]}`,
      priceCents: round10(opt.fixed * 100 + opt.perMm * len * 100),
      taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "made_to_order", leadTimeDays: 28, ...LEAD_PRESETS.closure_made,
      attributes: { kind: "side_closure", sideLengthMm: len, colorCode: color, option: opt.code, assembly: "monobloc", usableWidthMm: len - 240, validation: "to_confirm" },
    });
  }
  // Persienne : 2 couleurs, kit selon implantation. 3 et 4 m : panneau monobloc (démo).
  // 5 et 6 m : assemblage de modules avec poteau intermédiaire, non confirmé par le fournisseur → devis.
  for (const len of CLOSURE_LENGTHS) for (const color of ["ANTHRACITE", "WHITE"]) for (const mounting of ALL_MOUNTINGS) {
    const modular = len >= 5000;
    const modules = modular ? 2 : 1;
    out.push({
      sku: `ES-PA-${len / 1000}M-${color.slice(0, 3)}-${mounting === "wall" ? "ADO" : "AUT"}`,
      familySlug: "persienne-aluminium",
      label: `Persienne aluminium ${len / 1000} m – ${COLOR_LABEL[color]} – kit ${mounting === "wall" ? "adossée" : "autoportée"}${modular ? ` (assemblage ${modules} modules)` : ""}`,
      priceCents: round10(350 * 100 + 0.3 * len * 100), // 3 m ≈ 1 250 €, 6 m ≈ 2 150 €
      taxRateBps: 2000, purchasable: !modular, dataStatus: modular ? "unknown" : "demo", stockMode: "made_to_order", leadTimeDays: 28,
      ...(modular ? LEAD_PRESETS.to_confirm : LEAD_PRESETS.closure_made),
      attributes: {
        kind: "side_closure", sideLengthMm: len, colorCode: color, mounting,
        assembly: modular ? "modular" : "monobloc",
        modules,
        moduleLengthMm: modular ? len / 2 : len,
        usableWidthMm: len - 240 - (modular ? 120 : 0),
        intermediatePosts: modular ? 1 : 0,
        fixingKit: mounting === "wall" ? "kit adossée (fixation murale + poteau)" : "kit autoportée (2 poteaux)",
        validation: "to_confirm",
      },
    });
  }
  // Store vertical ZIP : 3 couleurs (dont noir), 4 longueurs
  for (const len of CLOSURE_LENGTHS) for (const color of ["ANTHRACITE", "WHITE", "BLACK"]) {
    out.push({
      sku: `ES-SV-${len / 1000}M-${color.slice(0, 3)}`,
      familySlug: "store-vertical-zip",
      label: `Store vertical ZIP ${len / 1000} m – ${COLOR_LABEL[color]}`,
      priceCents: round10(250 * 100 + 0.19 * len * 100), // 3 m ≈ 820 €, 6 m ≈ 1 390 €
      taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "stock", stockQty: 12, leadTimeDays: 7, ...LEAD_PRESETS.closure_stock,
      attributes: { kind: "side_closure", sideLengthMm: len, colorCode: color, option: "zip", assembly: "monobloc", usableWidthMm: len - 240, validation: "to_confirm" },
    });
  }
  return out;
}

function optionVariants(): Variant[] {
  const out: Variant[] = [];
  for (const dim of DIMENSIONS) for (const mounting of ALL_MOUNTINGS) for (const color of ["warm_white", "rgb"]) {
    const perimeter = 2 * (dim.widthMm + dim.lengthMm) / 1000;
    out.push({
      sku: `ES-LED-${dim.code.toUpperCase()}-${mounting === "wall" ? "ADO" : "AUT"}-${color === "rgb" ? "RGB" : "BC"}`,
      familySlug: "bandes-led",
      label: `Bandes LED ${color === "rgb" ? "RGB" : "blanc chaud"} – ${dim.label} ${mounting === "wall" ? "adossée" : "autoportée"}`,
      priceCents: round10(120 * 100 + perimeter * 20 * 100), // 3x4 (14 m) ≈ 400 €, 4x6 (20 m) ≈ 520 €
      taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "stock", stockQty: 25, leadTimeDays: 5, ...LEAD_PRESETS.option_stock,
      attributes: { kind: "option", dimensionCode: dim.code, mounting, variantOption: color },
    });
  }
  for (const [watt, price] of [["1500w", 219_00], ["2000w", 239_00]] as const) for (const color of ["ANTHRACITE", "WHITE"]) {
    if (watt === "2000w" && color === "WHITE") continue; // comme observé : 2000 W en anthracite seulement
    out.push({
      sku: `ES-CH-${watt.toUpperCase()}-${color.slice(0, 3)}`,
      familySlug: "lampe-chauffante",
      label: `Lampe chauffante ${watt.replace("w", " W")} – ${COLOR_LABEL[color]}`,
      priceCents: price, taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "stock", stockQty: 30, leadTimeDays: 5, ...LEAD_PRESETS.option_stock,
      attributes: { kind: "option", colorCode: color, variantOption: watt },
    });
  }
  for (const [size, price] of [["medium", 289_00], ["large", 319_00]] as const) for (const color of ["ANTHRACITE", "WHITE"]) {
    out.push({
      sku: `ES-LA-${size.toUpperCase()}-${color.slice(0, 3)}`,
      familySlug: "lanterne-ambiance",
      label: `Lanterne d'ambiance ${size === "medium" ? "moyenne" : "grande"} – ${COLOR_LABEL[color]}`,
      priceCents: price, taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "stock", stockQty: 3, leadTimeDays: 5, ...LEAD_PRESETS.option_stock,
      attributes: { kind: "option", colorCode: color, variantOption: size },
    });
  }
  for (const color of ["ANTHRACITE", "WHITE"]) {
    out.push({
      sku: `ES-AN-${color.slice(0, 3)}`,
      familySlug: "anemometre",
      label: `Anémomètre – ${COLOR_LABEL[color]}`,
      priceCents: 89_00, taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "stock", stockQty: 40, leadTimeDays: 5, ...LEAD_PRESETS.option_stock,
      attributes: { kind: "option", colorCode: color },
    });
  }
  // Câble d'alimentation : rallonge 6 m — référence, longueur et équipement compatible représentés ;
  // supplément et compatibilité électrique NON confirmés (0 €, non achetable, devis).
  out.push({
    sku: "ES-CAB-6M",
    familySlug: "cable-alimentation",
    label: "Rallonge de câble d'alimentation 6 m (store banne)",
    priceCents: 0, taxRateBps: 2000, purchasable: false, dataStatus: "unknown", stockMode: "made_to_order", leadTimeDays: null, ...LEAD_PRESETS.to_confirm,
    attributes: { kind: "option", variantOption: "6m", cableLengthMm: 6000, cableRole: "extension", compatibleWith: ["store-banne-ombra"], prerequisites: ["raccordement 230 V par un électricien", "longueur totale admissible par le moteur à confirmer"] },
  });
  return out;
}

/** Variantes de store banne réellement proposées (pas de produit cartésien). */
export const AWNING_SIZES: Array<{ widthMm: number; projectionMm: number; priceCents: number }> = [
  { widthMm: 2000, projectionMm: 1500, priceCents: 74_900 },
  { widthMm: 3000, projectionMm: 2000, priceCents: 94_900 },
  { widthMm: 3000, projectionMm: 2500, priceCents: 102_900 },
  { widthMm: 3500, projectionMm: 2500, priceCents: 116_900 },
  { widthMm: 3500, projectionMm: 3000, priceCents: 124_900 },
  { widthMm: 4000, projectionMm: 2500, priceCents: 131_900 },
  { widthMm: 4000, projectionMm: 3000, priceCents: 131_900 },
  { widthMm: 4000, projectionMm: 3500, priceCents: 139_900 },
  { widthMm: 5000, projectionMm: 2500, priceCents: 139_900 },
  { widthMm: 5000, projectionMm: 3000, priceCents: 147_900 },
  { widthMm: 5000, projectionMm: 3500, priceCents: 155_900 },
  { widthMm: 6000, projectionMm: 3000, priceCents: 171_900 },
];

function awningVariants(): Variant[] {
  const out: Variant[] = [];
  for (const s of AWNING_SIZES) for (const cabinet of ["ANTHRACITE", "WHITE"]) for (const fabric of [["GREY", "gris"], ["BEIGE", "beige"]] as const) {
    out.push({
      sku: `ES-SB-${s.widthMm / 100}${String(s.projectionMm / 100).padStart(2, "0")}-${cabinet.slice(0, 3)}-${fabric[0]}`,
      familySlug: "store-banne-ombra",
      label: `Store banne Ombra ${s.widthMm / 1000} × ${s.projectionMm / 1000} m – coffre ${COLOR_LABEL[cabinet]} – toile ${fabric[1]}`,
      priceCents: s.priceCents, taxRateBps: 2000, purchasable: true, dataStatus: "demo", stockMode: "made_to_order", leadTimeDays: 14, ...LEAD_PRESETS.awning,
      weightGrams: Math.round(30_000 + (s.widthMm - 2000) * 14),
      attributes: { kind: "awning", widthMm: s.widthMm, projectionMm: s.projectionMm, cabinetColor: cabinet, fabricCode: fabric[0] },
    });
  }
  return out;
}

export function buildVariants(): Variant[] {
  return [...pergolaVariants(), ...closureVariants(), ...optionVariants(), ...awningVariants()];
}

/* ------------------------------------------------------------------ */
/* Compatibilités                                                      */
/* ------------------------------------------------------------------ */

export const CLOSURE_COMPAT: ClosureCompatRule[] = [
  // Règle générale : fermetures compatibles avec les pergolas standard, segment ≤ 5 m
  { closureFamilySlug: "paroi-vitree", pergolaFamilySlug: "*", segmentLengthMm: "*", pergolaFinishCode: "*", mounting: "*", status: "allowed", dataStatus: "demo" },
  { closureFamilySlug: "persienne-aluminium", pergolaFamilySlug: "*", segmentLengthMm: "*", pergolaFinishCode: "*", mounting: "*", status: "allowed", dataStatus: "demo" },
  { closureFamilySlug: "store-vertical-zip", pergolaFamilySlug: "*", segmentLengthMm: "*", pergolaFinishCode: "*", mounting: "*", status: "allowed", dataStatus: "demo" },
  // Pergola noire : aucune paroi vitrée ni persienne noire au catalogue (observé) -> interdit avec explication
  { closureFamilySlug: "paroi-vitree", pergolaFamilySlug: "*", segmentLengthMm: "*", pergolaFinishCode: "BLACK", mounting: "*", status: "forbidden", reason: "la paroi vitrée n'existe pas en finition noire ; seul le store vertical ZIP est proposé en noir.", dataStatus: "demo" },
  { closureFamilySlug: "persienne-aluminium", pergolaFamilySlug: "*", segmentLengthMm: "*", pergolaFinishCode: "BLACK", mounting: "*", status: "forbidden", reason: "la persienne n'existe pas en finition noire.", dataStatus: "demo" },
  // Segment de 6 m monobloc : inexistant (le côté de 6 m est divisé) -> inconnu si jamais demandé
  { closureFamilySlug: "paroi-vitree", pergolaFamilySlug: "*", segmentLengthMm: 6000, pergolaFinishCode: "*", mounting: "*", status: "unknown", reason: "un côté de 6 m d'un seul tenant nécessite une validation fournisseur.", dataStatus: "unknown" },
  { closureFamilySlug: "persienne-aluminium", pergolaFamilySlug: "*", segmentLengthMm: 6000, pergolaFinishCode: "*", mounting: "*", status: "unknown", reason: "un côté de 6 m d'un seul tenant nécessite une validation fournisseur.", dataStatus: "unknown" },
  { closureFamilySlug: "store-vertical-zip", pergolaFamilySlug: "*", segmentLengthMm: 6000, pergolaFinishCode: "*", mounting: "*", status: "unknown", reason: "un côté de 6 m d'un seul tenant nécessite une validation fournisseur.", dataStatus: "unknown" },
  // Solis Max sur 5 m : profils différents -> compatibilité non confirmée (démonstration d'un cas "inconnu")
  { closureFamilySlug: "paroi-vitree", pergolaFamilySlug: "pergola-solis-max", segmentLengthMm: 5000, pergolaFinishCode: "*", mounting: "*", status: "unknown", reason: "profils renforcés de la Solis Max : fixation des parois vitrées de 5 m à confirmer par le fournisseur.", dataStatus: "unknown" },
];

export const OPTION_COMPAT: OptionCompatRule[] = [
  { optionFamilySlug: "bandes-led", pergolaFamilySlug: "pergola-solis", status: "allowed", maxQty: 1, dataStatus: "demo" },
  { optionFamilySlug: "bandes-led", pergolaFamilySlug: "pergola-solis-pro", status: "allowed", includedInBase: true, maxQty: 1, reason: "éclairage LED de gouttière déjà inclus", dataStatus: "demo" },
  { optionFamilySlug: "bandes-led", pergolaFamilySlug: "pergola-solis-max", status: "unknown", maxQty: 1, reason: "la Solis Max intègre l'éclairage aux lames ; l'ajout de bandes LED en gouttière n'est pas confirmé", dataStatus: "unknown" },
  { optionFamilySlug: "lampe-chauffante", pergolaFamilySlug: "*", status: "allowed", maxQty: 4, dataStatus: "demo" },
  { optionFamilySlug: "lanterne-ambiance", pergolaFamilySlug: "*", status: "allowed", maxQty: 6, dataStatus: "demo" },
  { optionFamilySlug: "anemometre", pergolaFamilySlug: "store-banne-ombra", status: "allowed", maxQty: 1, dataStatus: "demo" },
  { optionFamilySlug: "anemometre", pergolaFamilySlug: "*", status: "forbidden", reason: "l'anémomètre ne s'installe que sur un store banne", dataStatus: "demo" },
  { optionFamilySlug: "cable-alimentation", pergolaFamilySlug: "store-banne-ombra", status: "unknown", maxQty: 1, reason: "rallonge 6 m : longueur totale admissible et raccordement non confirmés par le fournisseur", dataStatus: "unknown" },
  { optionFamilySlug: "cable-alimentation", pergolaFamilySlug: "*", status: "forbidden", reason: "le câble d'alimentation ne concerne que le store banne motorisé", dataStatus: "demo" },
];

export const INSTALLATION_RATES: InstallationRate[] = [
  ...["pergola-solis", "pergola-solis-pro", "pergola-solis-max"].flatMap((slug) =>
    DIMENSIONS.map((d) => ({ familySlug: slug, dimensionCode: d.code, priceCents: round10(69_000 + ((d.widthMm * d.lengthMm) / 1_000_000) * 2_200), dataStatus: "demo" as const })),
  ),
  { familySlug: "side_closure", priceCents: 12_900, dataStatus: "demo" },
  { familySlug: "pergola-sur-mesure", priceCents: 119_000, dataStatus: "demo" },

  { familySlug: "store-banne-ombra", priceCents: 29_900, dataStatus: "demo" },
];

export const SHIPPING_RULES: ShippingRule[] = [
  { countryCode: "FR", postalPrefixes: [], priceCents: 0, label: "Livraison France métropolitaine (offerte, démonstration)" },
  { countryCode: "FR", postalPrefixes: ["20"], priceCents: 0, label: "Corse : livraison sur devis", quoteRequired: true },
  { countryCode: "FR", postalPrefixes: ["97", "98"], priceCents: 0, label: "Outre-mer : livraison sur devis", quoteRequired: true },
];

export const PROMOTIONS: Promotion[] = [
  { code: "BIENVENUE5", label: "Code de bienvenue (-5 % sur les pergolas, démonstration)", familySlugs: ["pergola-solis", "pergola-solis-pro", "pergola-solis-max"], percentBps: 500, active: true },
];

/* ------------------------------------------------------------------ */
/* Grille tarifaire sur mesure FICTIVE (test du moteur uniquement)       */
/* ------------------------------------------------------------------ */

/**
 * Grille de DÉMONSTRATION : cellules largeur × longueur avec prix explicites (aucun prix au m²),
 * suppléments finition / implantation / hauteur / fermetures / options. `isDemo: true` :
 * l'estimation ne devient jamais un prix ferme. Explicitement séparée des données commerciales.
 */
export const DEMO_PRICE_GRID: PriceGridSnapshot = {
  id: "demo-grid-sur-mesure-v1",
  familySlug: "pergola-sur-mesure",
  name: "Grille fictive de démonstration",
  version: 1,
  status: "published",
  mode: "table",
  validFrom: "2026-01-01T00:00:00.000Z",
  validTo: null,
  dataStatus: "demo",
  isDemo: true,
  widthMm: { min: 2000, max: 4000, step: 10 },
  lengthMm: { min: 2000, max: 6000, step: 10 },
  heightMm: { min: 2200, max: 3000, step: 10 },
  mountings: ["freestanding", "wall"],
  finishCodes: ["ANTHRACITE", "WHITE", "ANTHRACITE_WHITE_BLADES"],
  cells: (() => {
    const widths: Array<[number, number]> = [[2000, 3000], [3010, 3500], [3510, 4000]];
    const lengths: Array<[number, number]> = [[2000, 3000], [3010, 4000], [4010, 5000], [5010, 6000]];
    // prix TTC fictifs (centimes) par cellule — volontairement non proportionnels à la surface
    const table = [
      [349_000, 419_000, 489_000, 569_000],
      [389_000, 459_000, 539_000, 629_000],
      [429_000, 509_000, 599_000, 699_000],
    ];
    const cells = [];
    for (const [wi, w] of widths.entries()) for (const [li, l] of lengths.entries()) {
      cells.push({ widthMinMm: w[0], widthMaxMm: w[1], lengthMinMm: l[0], lengthMaxMm: l[1], mounting: "*" as const, finishCode: "*" as const, priceCents: table[wi]![li]! });
    }
    // la cellule 4 × 6 m adossée est volontairement absente de la grille fictive (zone sans tarif → devis)
    const kept: PriceGridSnapshot["cells"] = cells.filter((c) => !(c.widthMinMm === 3510 && c.lengthMinMm === 5010));
    kept.push({ widthMinMm: 3510, widthMaxMm: 4000, lengthMinMm: 5010, lengthMaxMm: 6000, mounting: "freestanding", finishCode: "*", priceCents: 699_000 });
    return kept;
  })(),
  surcharges: [
    { code: "finish-bicolor", label: "Finition bicolore (lames blanches)", kind: "finish", match: "ANTHRACITE_WHITE_BLADES", priceCents: 15_000, percentBps: 0 },
    { code: "mounting-wall", label: "Implantation adossée (2 poteaux)", kind: "mounting", match: "wall", priceCents: -12_000, percentBps: 0 },
    { code: "height-above-2500", label: "Hauteur au-delà de 2,50 m (par tranche de 100 mm)", kind: "height_above", match: "*", thresholdMm: 2500, perStepMm: 100, perStepCents: 6_000, priceCents: 0, percentBps: 0 },
    { code: "closure-paroi-vitree", label: "Paroi vitrée sur mesure (par côté)", kind: "side_closure", match: "paroi-vitree", priceCents: 190_000, percentBps: 0 },
    { code: "closure-persienne", label: "Persienne sur mesure (par côté)", kind: "side_closure", match: "persienne-aluminium", priceCents: 145_000, percentBps: 0 },
    { code: "closure-zip", label: "Store vertical ZIP sur mesure (par côté)", kind: "side_closure", match: "store-vertical-zip", priceCents: 95_000, percentBps: 0 },
    { code: "option-lampe", label: "Lampe chauffante", kind: "option", match: "lampe-chauffante", priceCents: 21_900, percentBps: 0 },
    { code: "option-lanterne", label: "Lanterne d'ambiance", kind: "option", match: "lanterne-ambiance", priceCents: 28_900, percentBps: 0 },
  ],
};

export function buildDemoCatalog(): CatalogSnapshot {
  return {
    version: DEMO_CATALOG_VERSION,
    generatedAt: "2026-10-19T00:00:00.000Z",
    taxRateBps: 2000,
    finishes: FINISHES,
    dimensions: DIMENSIONS,
    families: FAMILIES,
    variants: buildVariants(),
    closureCompat: CLOSURE_COMPAT,
    optionCompat: OPTION_COMPAT,
    installationRates: INSTALLATION_RATES,
    shippingRules: SHIPPING_RULES,
    promotions: PROMOTIONS,
    custom: {
      quoteOnly: true,
      widthMm: { min: 2000, max: 4000, step: 10 },
      lengthMm: { min: 2000, max: 6000, step: 10 },
      heightMm: { min: 2200, max: 3000, step: 10 },
      dataStatus: "unknown",
      grids: [DEMO_PRICE_GRID],
    },
    shipmentPolicy: "GROUPED",
  };
}
