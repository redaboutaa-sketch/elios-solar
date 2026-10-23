import type { TechnicalSpecValue } from "./technical-spec";
import type { SystemInput, SystemRules } from "./system";
import type { CategoryKey } from "./categories";
import type { SystemPrice, SystemPriceTable } from "./system-pricing";
/**
 * Types du catalogue tels que vus par le moteur de configuration.
 * Le moteur ne dépend ni de Prisma ni de React : il reçoit un instantané
 * (`CatalogSnapshot`) construit côté serveur depuis la base.
 */
import type { Cents } from "./money";

export type DataStatus = "demo" | "supplier_verified" | "observed" | "unknown";
export type CompatStatus = "allowed" | "forbidden" | "unknown";
export type Mounting = "freestanding" | "wall";
export type FamilyKind =
  | "pergola_standard"
  | "pergola_custom"
  | "awning"
  | "side_closure"
  | "option"
  | "service"
  /* systèmes configurables à la cote (catalogue HELIOSTORES), règles sourcées dans `systemRules` */
  | "pergola_system"
  | "screen_system"
  | "awning_system"
  | "roof_blind_system";

export type LightingIncluded = "none" | "gutter_led" | "blade_led";
/** Disponibilité commerciale d'une référence (saisie admin / import fournisseur). */
export type Availability = "available" | "on_order" | "out_of_stock" | "to_confirm";
export type LeadUnit = "business_days" | "calendar_days" | "weeks";

export interface Finish {
  code: string; // ex. ANTHRACITE, WHITE, ANTHRACITE_WHITE_BLADES, BLACK
  label: string;
  structureColor: string; // code couleur structure (ANTHRACITE, WHITE, BLACK)
  bladeColor: string; // code couleur lames
  swatch: string; // couleur CSS indicative
}

export interface DimensionPreset {
  code: string; // "3x4"
  label: string; // "3 × 4 m"
  widthMm: number; // largeur commerciale (côtés gauche/droit)
  lengthMm: number; // longueur commerciale (côtés avant/arrière, côté mur en adossée)
}

export interface Family {
  slug: string;
  name: string;
  kind: FamilyKind;
  status: "published" | "draft" | "quote_only" | "archived";
  generation?: string;
  shortDescription: string;
  /** Pour les pergolas standard */
  roof?: "manual" | "motorized";
  lightingIncluded?: LightingIncluded;
  accessoryRails?: number;
  /** Longueur de côté à partir de laquelle un poteau intermédiaire divise le côté en 2 segments. */
  dividerThresholdMm?: number;
  /** Les finitions proposées (codes) */
  finishCodes?: string[];
  /** Codes des dimensions proposées */
  dimensionCodes?: string[];
  mountings?: Mounting[];
  /** Caractéristiques affichées (validées = statut) */
  specs?: Array<{ label: string; value: string; status: DataStatus }>;
  /** Données techniques sourcées (démo, observation, confirmation fournisseur) — voir technical-spec.ts */
  technicalSpecs?: TechnicalSpecValue[];
  dataStatus: DataStatus;
  /** famille publique (Pergolas, Screens, Stores bannes) ; absent = hors navigation */
  category?: CategoryKey | null;
  /** marque commerciale, fabricant et référence exacte quand une source les établit */
  brand?: string | null;
  manufacturer?: string | null;
  supplierRef?: string | null;
  /** règles du configurateur à la cote (systèmes HELIOSTORES) */
  systemRules?: SystemRules | null;
  /** grille publique « Prix final HELIOSTORES » (version active du classeur) ; absente = prix au devis */
  systemPrices?: SystemPriceTable | null;
  /** ancien produit de démonstration conservé pour l'historique */
  legacy?: boolean;
}

/** Variante vendable (SKU). Les attributs dépendent du type de famille. */
export interface Variant {
  sku: string;
  familySlug: string;
  label: string;
  priceCents: Cents; // prix TTC catalogue
  compareAtCents?: Cents | null;
  taxRateBps: number; // 2000 = 20 %
  purchasable: boolean; // false = brouillon / devis uniquement
  dataStatus: DataStatus;
  stockMode: "stock" | "made_to_order";
  stockQty?: number | null;
  /** délai indicatif historique (jours) ; remplacé par leadMinDays/leadMaxDays quand renseignés */
  leadTimeDays?: number | null;
  weightGrams?: number | null;
  /* Disponibilité et délais par référence */
  availability?: Availability;
  leadMinDays?: number | null;
  leadMaxDays?: number | null;
  leadUnit?: LeadUnit;
  /** origine de l'information de délai */
  leadSource?: DataStatus;
  leadUpdatedAt?: string | null;
  /** décomposition du délai (jours, même unité que leadUnit) */
  leadComponents?: { supplier?: number | null; preparation?: number | null; production?: number | null; transport?: number | null };
  preorderAllowed?: boolean;
  partialShipAllowed?: boolean;
  attributes: VariantAttributes;
}

export type VariantAttributes =
  | {
      kind: "pergola_standard";
      finishCode: string;
      dimensionCode: string;
      mounting: Mounting;
    }
  | {
      kind: "side_closure";
      /** longueur commerciale du côté couvert (mm) */
      sideLengthMm: number;
      colorCode: string; // ANTHRACITE | WHITE | BLACK
      option?: string; // ex. sliding_frameless | sliding_framed | fixed | zip
      mounting?: Mounting; // persienne : kit différent selon implantation
      /** panneau d'un seul tenant ou assemblage de modules */
      assembly?: "monobloc" | "modular";
      /** nombre de modules (assemblage) */
      modules?: number;
      /** longueur d'un module (mm) */
      moduleLengthMm?: number;
      /** cote utile couverte entre poteaux (mm) : ne pas déduire de la seule largeur nominale */
      usableWidthMm?: number;
      /** poteaux intermédiaires nécessaires à l'assemblage */
      intermediatePosts?: number;
      /** kit de fixation (libellé fournisseur) */
      fixingKit?: string;
      /** validation fournisseur de l'assemblage */
      validation?: "confirmed" | "to_confirm";
    }
  | {
      kind: "option";
      /** certaines options dépendent de la dimension/implantation (bandes LED) */
      dimensionCode?: string;
      mounting?: Mounting;
      colorCode?: string;
      variantOption?: string; // ex. warm_white | rgb | 1500w | 2000w | medium | large
      /** câbles : longueur, rôle (inclus ou rallonge), équipement compatible, prérequis */
      cableLengthMm?: number;
      cableRole?: "included" | "extension";
      compatibleWith?: string[];
      prerequisites?: string[];
    }
  | {
      kind: "awning";
      widthMm: number;
      projectionMm: number;
      cabinetColor: string;
      fabricCode: string;
    }
  | { kind: "service" };

/** Compatibilité d'une fermeture latérale avec une pergola, par segment. */
export interface ClosureCompatRule {
  closureFamilySlug: string;
  pergolaFamilySlug: string | "*";
  /** longueur de segment concernée (mm) ou "*" */
  segmentLengthMm: number | "*";
  /** code de finition pergola ou "*" */
  pergolaFinishCode: string | "*";
  mounting: Mounting | "*";
  status: CompatStatus;
  reason?: string;
  dataStatus: DataStatus;
}

/** Compatibilité d'une option (éclairage, chauffage…) avec une gamme. */
export interface OptionCompatRule {
  optionFamilySlug: string;
  pergolaFamilySlug: string | "*";
  status: CompatStatus;
  /** l'option est déjà incluse dans la gamme : ne pas refacturer */
  includedInBase?: boolean;
  maxQty?: number;
  reason?: string;
  dataStatus: DataStatus;
}

export interface InstallationRate {
  familySlug: string;
  dimensionCode?: string; // pergola : par dimension ; fermeture : "*"
  priceCents: Cents;
  dataStatus: DataStatus;
}

export interface ShippingRule {
  countryCode: string; // "FR"
  /** préfixes de code postal (ex. "20" Corse) ; vide = reste du pays */
  postalPrefixes: string[];
  priceCents: Cents;
  label: string;
  /** certaines zones nécessitent un devis */
  quoteRequired?: boolean;
}

export interface Promotion {
  code: string;
  label: string;
  /** familles concernées ("*" = toutes) */
  familySlugs: string[] | "*";
  percentBps: number; // 1000 = 10 %
  startsAt?: string;
  endsAt?: string;
  active: boolean;
}

export interface CatalogSnapshot {
  version: string;
  generatedAt: string;
  taxRateBps: number;
  finishes: Finish[];
  dimensions: DimensionPreset[];
  families: Family[];
  variants: Variant[];
  closureCompat: ClosureCompatRule[];
  optionCompat: OptionCompatRule[];
  installationRates: InstallationRate[];
  shippingRules: ShippingRule[];
  promotions: Promotion[];
  /** paramètres de sur-mesure ; `quoteOnly` tant que la grille fournisseur n'est pas validée */
  custom: {
    quoteOnly: boolean;
    widthMm: { min: number; max: number; step: number };
    lengthMm: { min: number; max: number; step: number };
    heightMm: { min: number; max: number; step: number };
    dataStatus: DataStatus;
    /** grilles tarifaires publiées (une par famille sur mesure) */
    grids?: PriceGridSnapshot[];
  };
  /** politique d'expédition multi-références */
  shipmentPolicy?: "GROUPED" | "SEPARATE";
}

/* ------------------------------------------------------------------ */
/* Grilles tarifaires sur mesure                                        */
/* ------------------------------------------------------------------ */

export type GridStatus = "draft" | "testing" | "published" | "archived";

export interface PriceGridCell {
  widthMinMm: number;
  widthMaxMm: number;
  lengthMinMm: number;
  lengthMaxMm: number;
  mounting: Mounting | "*";
  finishCode: string | "*";
  priceCents: Cents;
}

export type SurchargeKind = "finish" | "mounting" | "height_above" | "side_closure" | "option" | "percent";

export interface PriceGridSurcharge {
  code: string;
  label: string;
  kind: SurchargeKind;
  /** valeur à apparier : code finition, implantation, slug de fermeture ou d'option, "*" */
  match: string;
  thresholdMm?: number | null;
  perStepMm?: number | null;
  perStepCents?: Cents | null;
  priceCents: Cents;
  percentBps: number;
}

export interface PriceGridSnapshot {
  id: string;
  familySlug: string;
  name: string;
  version: number;
  status: GridStatus;
  mode: "table" | "bands";
  validFrom?: string | null;
  validTo?: string | null;
  dataStatus: DataStatus;
  isDemo: boolean;
  widthMm: { min: number; max: number; step: number };
  lengthMm: { min: number; max: number; step: number };
  heightMm: { min: number; max: number; step: number };
  mountings: Mounting[];
  finishCodes: string[];
  cells: PriceGridCell[];
  surcharges: PriceGridSurcharge[];
}

/* ------------------------------------------------------------------ */
/* Entrées de configuration                                            */
/* ------------------------------------------------------------------ */

export type SideKey = "front" | "back" | "left" | "right";

export interface SegmentChoice {
  closureFamilySlug: string;
  /** option de la fermeture (ex. sliding_frameless) ; la couleur suit la structure */
  option?: string;
}

export interface OptionChoice {
  familySlug: string;
  variantOption?: string;
  qty: number;
}

export interface DeliveryInput {
  countryCode: string;
  postalCode?: string;
}

export interface PergolaStandardInput {
  kind: "pergola_standard";
  familySlug: string;
  mounting: Mounting;
  dimensionCode: string;
  finishCode: string;
  /** clé = identifiant de segment (ex. "left-1"), valeur = fermeture choisie */
  segments: Record<string, SegmentChoice | null>;
  options: OptionChoice[];
  installation: "self" | "professional";
  delivery: DeliveryInput;
  promotionCode?: string;
}

export interface PergolaCustomInput {
  kind: "pergola_custom";
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  mounting: Mounting;
  finishCode: string;
  /** souhaits de fermeture par côté (devis) */
  sides: Partial<Record<SideKey, { closureFamilySlug: string } | null>>;
  options: OptionChoice[];
  installation: "self" | "professional";
  delivery: DeliveryInput;
  notes?: string;
}

export interface AwningInput {
  kind: "awning";
  familySlug: string;
  widthMm: number;
  projectionMm: number;
  cabinetColor: string;
  fabricCode: string;
  bracketMount: "wall" | "ceiling";
  options: OptionChoice[];
  installation: "self" | "professional";
  delivery: DeliveryInput;
  promotionCode?: string;
}

/** Accessoire acheté seul : la compatibilité avec une pergola existante doit être renseignée. */
export interface AccessoryStandaloneInput {
  kind: "accessory";
  familySlug: string;
  sku: string;
  qty: number;
  target: {
    pergolaFamilySlug: string;
    dimensionCode?: string;
    mounting?: Mounting;
    finishCode?: string;
    segmentLengthMm?: number;
  };
  delivery: DeliveryInput;
  promotionCode?: string;
}

export type ConfigurationInput =
  | PergolaStandardInput
  | PergolaCustomInput
  | AwningInput
  | AccessoryStandaloneInput
  | SystemInput;

/* ------------------------------------------------------------------ */
/* Résultat                                                            */
/* ------------------------------------------------------------------ */

export interface Segment {
  id: string; // "left-1"
  side: SideKey;
  index: number; // 1..n
  lengthMm: number;
  /** poteau intermédiaire après ce segment (côté divisé) */
  hasDividerPost: boolean;
}

export interface Side {
  key: SideKey;
  lengthMm: number;
  isWall: boolean;
  segments: Segment[];
}

export interface Layout {
  widthMm: number;
  lengthMm: number;
  mounting: Mounting;
  sides: Side[];
  /** nombre de poteaux (indicatif, pas un calcul structurel) */
  postCount: number;
}

export type IssueSeverity = "blocking" | "review" | "info";

export interface Issue {
  code: string;
  severity: IssueSeverity;
  message: string;
  /** chemin de l'élément concerné (ex. "segments.left-1", "options.0") */
  path?: string;
  /** l'élément est inconnu : proposer un devis */
  quoteSuggested?: boolean;
}

export type LineKind =
  | "base"
  | "closure"
  | "option"
  | "installation"
  | "shipping"
  | "discount";

export interface PriceLine {
  kind: LineKind;
  code: string;
  label: string;
  sku?: string;
  qty: number;
  unitGrossCents: Cents;
  totalGrossCents: Cents;
  taxRateBps: number;
  /** inclus dans la base : affiché à 0, non facturé */
  included?: boolean;
  path?: string;
  dataStatus: DataStatus;
}

export interface Totals {
  goodsGrossCents: Cents;
  installationGrossCents: Cents;
  shippingGrossCents: Cents | null;
  discountGrossCents: Cents;
  taxCents: Cents;
  totalGrossCents: Cents;
  /** false tant qu'une donnée manque (code postal) ou qu'une ligne est en devis */
  isFinal: boolean;
  currency: "EUR";
}

export interface EvaluationResult {
  engineVersion: string;
  catalogVersion: string;
  input: ConfigurationInput;
  layout?: Layout;
  lines: PriceLine[];
  totals: Totals;
  issues: Issue[];
  /** demo = au moins une ligne repose sur des données de démonstration */
  containsDemoData: boolean;
  /** la configuration peut être ajoutée au panier (aucun blocage) */
  purchasable: boolean;
  /** un devis est le parcours recommandé */
  quoteRecommended: boolean;
  /** « quote » : système HELIOSTORES, affiché par son récapitulatif et le prix de la grille (une configuration entièrement
   * tarifée porte en plus sa ligne de structure TTC et peut aller au panier, voir `onlineOrder`). Absent = ancien résultat chiffré. */
  priceMode?: "priced" | "quote";
  /** système : prix de la grille « Prix final HELIOSTORES » pour la cote demandée (null = hors grille, chiffré au devis) */
  systemPrice?: SystemPrice | null;
  /** cote absente de la grille : dimensions tarifées en ligne pour la variante choisie (lecture exacte) */
  pricedSizes?: { dimLabel: string; dims: number[]; widths: { min: number; max: number }[]; roundUp: boolean } | null;
  /** système : commande en ligne possible (configuration entièrement tarifée) ou motifs du passage au devis */
  onlineOrder?: { ok: boolean; reasons: string[] };
  /** récapitulatif lisible de la configuration (devis sans prix, PDF, administration) */
  recap?: RecapItem[];
}

export interface RecapItem {
  label: string;
  value: string;
  /** inclus dans le système, option choisie, ou point à confirmer au devis */
  status?: "included" | "option" | "to_confirm";
}
