/**
 * Règles d'éligibilité et de répartition du paiement fractionné.
 * Module PUR (aucun accès base, aucune variable d'environnement lue ici) : testable unitairement.
 */

export type InstallmentProviderKey = "none" | "stripe_klarna" | "stripe_alma" | "simulator";
export type PaymentEnv = "test" | "prod";

export const INSTALLMENT_PROVIDERS: readonly InstallmentProviderKey[] = ["none", "stripe_klarna", "stripe_alma", "simulator"] as const;

/** Réglages tels que stockés (sous-ensemble du modèle Prisma `InstallmentSettings`). */
export interface InstallmentRules {
  provider: string;
  enabledTest: boolean;
  enabledProd: boolean;
  merchantEligible: boolean;
  minCents: number;
  maxCents: number;
  countries: string[];
  currency: string;
  installmentCounts: number[];
  feesBps: number;
  feesFixedCents: number;
  feesLabel: string;
  noFeesConfirmed: boolean;
  termsUrl?: string | null;
}

export interface ProviderBounds {
  key: InstallmentProviderKey;
  /** Libellé affiché au client. */
  label: string;
  /** Moyen de paiement Stripe Checkout (`allowed_payment_method_types`), ou null pour le simulateur. */
  stripePaymentMethod: "klarna" | "alma" | null;
  /** Bornes publiées par le prestataire (centimes, EUR). `null` = pas de borne propre (simulateur : réglages). */
  minCents: number | null;
  maxCents: number | null;
  /** Nombres d'échéances proposés par le prestataire pour un client en France. */
  counts: number[];
  /** Pays clients acceptés par le prestataire pour un marchand français. */
  countries: string[];
  /** Utilisable en production ? Le simulateur ne l'est jamais. */
  productionCapable: boolean;
  docsUrl: string | null;
}

/**
 * Bornes connues des prestataires (documentation Stripe consultée le 2026-10-19) :
 * - Klarna, clients FR : paiement en 3 fois sans intérêts de 1 € à 3 000 € (100–300 000 c). https://docs.stripe.com/payments/klarna
 * - Alma : 2/3/4 fois de 50 € à 5 000 € (5 000–500 000 c), clients FR/IT/ES/NL/BE/LU. https://docs.stripe.com/payments/alma
 */
export const PROVIDER_BOUNDS: Record<InstallmentProviderKey, ProviderBounds> = {
  none: { key: "none", label: "Aucun", stripePaymentMethod: null, minCents: null, maxCents: null, counts: [], countries: [], productionCapable: false, docsUrl: null },
  stripe_klarna: { key: "stripe_klarna", label: "Klarna (via Stripe)", stripePaymentMethod: "klarna", minCents: 100, maxCents: 300_000, counts: [3], countries: ["FR"], productionCapable: true, docsUrl: "https://docs.stripe.com/payments/klarna" },
  stripe_alma: { key: "stripe_alma", label: "Alma (via Stripe)", stripePaymentMethod: "alma", minCents: 5_000, maxCents: 500_000, counts: [2, 3, 4], countries: ["FR", "IT", "ES", "NL", "BE", "LU"], productionCapable: true, docsUrl: "https://docs.stripe.com/payments/alma" },
  simulator: { key: "simulator", label: "Simulateur (test uniquement)", stripePaymentMethod: null, minCents: null, maxCents: null, counts: [2, 3, 4, 5, 6, 10, 12], countries: ["FR", "BE", "LU", "CH", "IT", "ES", "NL", "DE"], productionCapable: false, docsUrl: null },
};

export function providerBounds(provider: string): ProviderBounds {
  return PROVIDER_BOUNDS[(INSTALLMENT_PROVIDERS as readonly string[]).includes(provider) ? (provider as InstallmentProviderKey) : "none"];
}

/** Environnement de paiement : « prod » uniquement avec Stripe ET une clé live. Fonction pure (les variables sont passées en argument). */
export function paymentEnvFrom(env: { PAYMENT_PROVIDER?: string; STRIPE_SECRET_KEY?: string }): PaymentEnv {
  return env.PAYMENT_PROVIDER === "stripe" && (env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") ? "prod" : "test";
}

/** Répartition exacte en centimes : les n−1 dernières échéances valent floor(total/n), la première absorbe le reste. */
export function splitInstallments(totalCents: number, count: number): { firstCents: number; otherCents: number } {
  if (!Number.isInteger(totalCents) || totalCents < 0) throw new Error("montant invalide");
  if (!Number.isInteger(count) || count < 1) throw new Error("nombre d'échéances invalide");
  const other = Math.floor(totalCents / count);
  const first = totalCents - other * (count - 1);
  return { firstCents: first, otherCents: other };
}

/** Frais client (centimes) : proportionnels (points de base) + fixes. */
export function computeFeesCents(totalCents: number, rules: Pick<InstallmentRules, "feesBps" | "feesFixedCents">): number {
  return Math.round((totalCents * rules.feesBps) / 10_000) + rules.feesFixedCents;
}

export type FeesKind = "none_confirmed" | "fees" | "unconfirmed";

/**
 * Libellé des frais. « Sans frais » n'est affiché QUE si le contrat le confirme (`noFeesConfirmed`)
 * et qu'aucun frais n'est paramétré. Un montant de frais paramétré est affiché tel quel ; un
 * paramétrage à zéro sans confirmation donne « frais non confirmés ».
 */
export function feesLabelFor(totalCents: number, rules: Pick<InstallmentRules, "feesBps" | "feesFixedCents" | "noFeesConfirmed" | "feesLabel">): { kind: FeesKind; feesCents: number; label: string } {
  const feesCents = computeFeesCents(totalCents, rules);
  if (rules.feesBps === 0 && rules.feesFixedCents === 0) {
    if (rules.noFeesConfirmed) return { kind: "none_confirmed", feesCents: 0, label: rules.feesLabel.trim() || "sans frais" };
    return { kind: "unconfirmed", feesCents: 0, label: "frais non confirmés (selon contrat prestataire)" };
  }
  const euros = (feesCents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { kind: "fees", feesCents, label: `frais : ${euros} € (selon contrat prestataire)${rules.feesLabel.trim() ? ` — ${rules.feesLabel.trim()}` : ""}` };
}

export interface InstallmentPlan {
  count: number;
  firstCents: number;
  otherCents: number;
  feesCents: number;
  totalWithFeesCents: number;
  feesKind: FeesKind;
  label: string;
}

export interface EligibilityInput {
  totalCents: number;
  countryCode: string;
  settings: InstallmentRules;
  env: PaymentEnv;
  currency?: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  plans: InstallmentPlan[];
  provider: ProviderBounds;
  providerLabel: string;
  termsUrl: string | null;
}

/**
 * Éligibilité d'un montant au paiement fractionné. Pure : le montant doit être celui recalculé
 * côté serveur par l'appelant (jamais celui du navigateur).
 */
export function installmentEligibility(input: EligibilityInput): EligibilityResult {
  const { totalCents, settings, env } = input;
  const countryCode = input.countryCode.toUpperCase();
  const currency = (input.currency ?? "EUR").toUpperCase();
  const provider = providerBounds(settings.provider);
  const reasons: string[] = [];
  const base = { provider, providerLabel: provider.label, termsUrl: settings.termsUrl ?? null };

  if (provider.key === "none") reasons.push("aucun prestataire de paiement fractionné configuré");
  if (env === "prod") {
    if (!settings.enabledProd) reasons.push("paiement fractionné désactivé en production");
    if (!settings.merchantEligible) reasons.push("compte marchand non validé par le prestataire (merchantEligible)");
    if (!provider.productionCapable && provider.key !== "none") reasons.push(`le prestataire « ${provider.label} » n'est pas utilisable en production`);
  } else if (!settings.enabledTest) {
    reasons.push("paiement fractionné désactivé en environnement de test");
  }
  if (currency !== "EUR" || settings.currency.toUpperCase() !== "EUR") reasons.push("devise non prise en charge (EUR uniquement)");
  if (!settings.countries.map((c) => c.toUpperCase()).includes(countryCode)) reasons.push(`pays de livraison ${countryCode} non couvert par les réglages`);
  if (provider.key !== "none" && provider.countries.length && !provider.countries.includes(countryCode)) reasons.push(`pays ${countryCode} non accepté par ${provider.label}`);

  const minCents = Math.max(settings.minCents, provider.minCents ?? 0);
  const maxCents = Math.min(settings.maxCents, provider.maxCents ?? Number.MAX_SAFE_INTEGER);
  if (!Number.isInteger(totalCents) || totalCents <= 0) reasons.push("montant invalide");
  else if (totalCents < minCents) reasons.push(`montant inférieur au minimum (${(minCents / 100).toFixed(2)} €)`);
  else if (totalCents > maxCents) reasons.push(`montant supérieur au maximum (${(maxCents / 100).toFixed(2)} €)`);

  const counts = [...new Set(settings.installmentCounts)].filter((n) => Number.isInteger(n) && n >= 2 && (provider.counts.length === 0 || provider.counts.includes(n))).sort((a, b) => a - b);
  if (counts.length === 0) reasons.push("aucun nombre d'échéances compatible avec le prestataire");

  if (reasons.length > 0) return { ...base, eligible: false, reasons, plans: [] };

  const fees = feesLabelFor(totalCents, settings);
  const plans: InstallmentPlan[] = counts.map((count) => {
    const totalWithFees = totalCents + fees.feesCents;
    const { firstCents, otherCents } = splitInstallments(totalWithFees, count);
    return { count, firstCents, otherCents, feesCents: fees.feesCents, totalWithFeesCents: totalWithFees, feesKind: fees.kind, label: `${count} fois via ${provider.label} — ${fees.label}` };
  });
  return { ...base, eligible: true, reasons: [], plans };
}

/** Vérification de cohérence des réglages (contrôle serveur avant enregistrement). */
export function validateInstallmentRules(r: InstallmentRules): string[] {
  const errors: string[] = [];
  const provider = providerBounds(r.provider);
  if (!(INSTALLMENT_PROVIDERS as readonly string[]).includes(r.provider)) errors.push("prestataire inconnu");
  if (r.enabledProd && (provider.key === "none" || provider.key === "simulator")) errors.push("activation en production impossible sans prestataire réel (Klarna ou Alma via Stripe)");
  if (r.enabledProd && !r.merchantEligible) errors.push("activation en production impossible tant que le compte marchand n'est pas validé par le prestataire");
  if (r.minCents < 0 || r.maxCents <= 0 || r.minCents > r.maxCents) errors.push("bornes de montant incohérentes (min ≤ max)");
  if (provider.minCents !== null && r.minCents < provider.minCents) errors.push(`minimum inférieur à celui de ${provider.label} (${(provider.minCents / 100).toFixed(2)} €)`);
  if (provider.maxCents !== null && r.maxCents > provider.maxCents) errors.push(`maximum supérieur à celui de ${provider.label} (${(provider.maxCents / 100).toFixed(2)} €)`);
  if (r.installmentCounts.length === 0 || r.installmentCounts.some((n) => !Number.isInteger(n) || n < 2 || n > 24)) errors.push("nombres d'échéances invalides (entiers entre 2 et 24)");
  if (provider.counts.length && r.installmentCounts.some((n) => !provider.counts.includes(n))) errors.push(`${provider.label} ne propose que : ${provider.counts.join(", ")} fois`);
  if (r.feesBps < 0 || r.feesBps > 5_000 || r.feesFixedCents < 0) errors.push("frais invalides");
  if (r.noFeesConfirmed && (r.feesBps > 0 || r.feesFixedCents > 0)) errors.push("« sans frais confirmé » incompatible avec des frais paramétrés");
  if (r.currency.toUpperCase() !== "EUR") errors.push("devise : EUR uniquement");
  if (r.countries.length === 0 || r.countries.some((c) => !/^[A-Z]{2}$/.test(c))) errors.push("pays : codes ISO à 2 lettres");
  if (r.termsUrl && !/^https:\/\/[^\s"'<>]+$/.test(r.termsUrl)) errors.push("URL des CGU : https:// attendu");
  return errors;
}
