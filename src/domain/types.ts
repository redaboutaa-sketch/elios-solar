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
  | "service";

export type LightingIncluded = "none" | "gutter_led" | "blade_led";

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
  dataStatus: DataStatus;
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
  leadTimeDays?: number | null;
  weightGrams?: number | null;
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
    }
  | {
      kind: "option";
      /** certaines options dépendent de la dimension/implantation (bandes LED) */
      dimensionCode?: string;
      mounting?: Mounting;
      colorCode?: string;
      variantOption?: string; // ex. warm_white | rgb | 1500w | 2000w | medium | large
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
  };
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
  | AccessoryStandaloneInput;

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
}
