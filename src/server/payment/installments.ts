import { prisma } from "@/lib/prisma";
import type { InstallmentSettings } from "@/generated/prisma/client";
import { installmentEligibility, paymentEnvFrom, providerBounds, type EligibilityResult, type PaymentEnv } from "./installments-rules";

export { installmentEligibility, paymentEnvFrom, providerBounds, PROVIDER_BOUNDS, validateInstallmentRules } from "./installments-rules";
export type { EligibilityResult, InstallmentPlan, InstallmentRules, PaymentEnv } from "./installments-rules";

/** Réglages du paiement fractionné (singleton id=1, créé à la volée avec les valeurs par défaut du schéma). */
export async function getInstallmentSettings(): Promise<InstallmentSettings> {
  return prisma.installmentSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

/** « prod » uniquement si PAYMENT_PROVIDER=stripe et clé secrète live ; sinon « test ». */
export function currentEnv(): PaymentEnv {
  return paymentEnvFrom({ PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY });
}

/** État des clés et du prestataire pour l'encart d'administration (ne révèle jamais les valeurs). */
export function installmentsRuntimeStatus(settings: InstallmentSettings) {
  const env = currentEnv();
  const stripeKey = !!process.env.STRIPE_SECRET_KEY;
  const stripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
  const stripeActive = process.env.PAYMENT_PROVIDER === "stripe" && stripeKey && stripeWebhook;
  const provider = providerBounds(settings.provider);
  const enabled = env === "prod" ? settings.enabledProd : settings.enabledTest;
  const stripeNeeded = provider.stripePaymentMethod !== null;
  const blockers: string[] = [];
  if (provider.key === "none") blockers.push("aucun prestataire sélectionné");
  if (!enabled) blockers.push(`désactivé pour l'environnement « ${env} »`);
  if (env === "prod" && !settings.merchantEligible) blockers.push("compte marchand non validé");
  if (stripeNeeded && !stripeActive) blockers.push("Stripe n'est pas le prestataire actif (PAYMENT_PROVIDER / clés manquantes) : le prestataire choisi ne peut pas être contacté");
  if (provider.key === "simulator" && process.env.PAYMENT_PROVIDER === "stripe") blockers.push("le simulateur est inactif quand PAYMENT_PROVIDER=stripe");
  return { env, stripeKeyPresent: stripeKey, stripeWebhookPresent: stripeWebhook, stripeActive, demoWebhookSecretPresent: !!(process.env.INSTALLMENTS_SIM_WEBHOOK_SECRET || process.env.DEMO_PAYMENT_WEBHOOK_SECRET), provider, enabled, operational: blockers.length === 0, blockers };
}

/**
 * Éligibilité d'un montant recalculé côté serveur. Le simulateur n'est jamais proposé
 * lorsque Stripe est le prestataire actif ; Klarna/Alma ne le sont jamais sans Stripe actif.
 */
export async function installmentsOfferFor(totalCents: number, countryCode: string, settings?: InstallmentSettings, customerType: "B2C" | "B2B" | null = null): Promise<EligibilityResult> {
  const s = settings ?? (await getInstallmentSettings());
  const status = installmentsRuntimeStatus(s);
  const result = installmentEligibility({ totalCents, countryCode, settings: s, env: status.env, customerType, merchantCountry: process.env.MERCHANT_COUNTRY ?? "FR" });
  if (!result.eligible) return result;
  const runtimeBlockers = status.blockers.filter((b) => b.startsWith("Stripe") || b.startsWith("le simulateur"));
  if (runtimeBlockers.length) return { ...result, eligible: false, plans: [], reasons: runtimeBlockers };
  return result;
}
