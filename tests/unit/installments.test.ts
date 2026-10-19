import { describe, expect, it } from "vitest";
import { computeFeesCents, feesLabelFor, installmentEligibility, paymentEnvFrom, splitInstallments, validateInstallmentRules, type InstallmentRules } from "@/server/payment/installments-rules";

function rules(over: Partial<InstallmentRules> = {}): InstallmentRules {
  return { provider: "simulator", enabledTest: true, enabledProd: false, merchantEligible: false, minCents: 5_000, maxCents: 800_000, countries: ["FR"], currency: "EUR", installmentCounts: [3], feesBps: 0, feesFixedCents: 0, feesLabel: "", noFeesConfirmed: false, termsUrl: null, ...over };
}

describe("environnement de paiement", () => {
  it("prod uniquement avec Stripe et une clé live", () => {
    expect(paymentEnvFrom({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_live_x" })).toBe("prod");
    expect(paymentEnvFrom({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test_x" })).toBe("test");
    expect(paymentEnvFrom({ PAYMENT_PROVIDER: "demo", STRIPE_SECRET_KEY: "sk_live_x" })).toBe("test");
    expect(paymentEnvFrom({})).toBe("test");
  });
});

describe("répartition en centimes", () => {
  for (const n of [2, 3, 4]) {
    for (const total of [300_000, 299_999, 100_001, 5_000, 487_651, 7]) {
      it(`${total} c en ${n} fois : somme exacte, première échéance absorbe le reste`, () => {
        const { firstCents, otherCents } = splitInstallments(total, n);
        expect(firstCents + otherCents * (n - 1)).toBe(total);
        expect(otherCents).toBe(Math.floor(total / n));
        expect(firstCents - otherCents).toBeGreaterThanOrEqual(0);
        expect(firstCents - otherCents).toBeLessThan(n);
      });
    }
  }
  it("exemple : 1 000,01 € en 3 fois", () => expect(splitInstallments(100_001, 3)).toEqual({ firstCents: 33_335, otherCents: 33_333 }));
  it("refuse un nombre d'échéances ou un montant invalide", () => {
    expect(() => splitInstallments(100, 0)).toThrow();
    expect(() => splitInstallments(10.5, 3)).toThrow();
  });
});

describe("frais et libellé « sans frais »", () => {
  it("jamais « sans frais » sans confirmation contractuelle", () => {
    const f = feesLabelFor(250_000, rules({ noFeesConfirmed: false }));
    expect(f.kind).toBe("unconfirmed");
    expect(f.label).not.toMatch(/sans frais/i);
    expect(f.label).toMatch(/frais non confirmés/);
  });
  it("« sans frais » seulement si frais nuls ET confirmés", () => {
    expect(feesLabelFor(250_000, rules({ noFeesConfirmed: true })).label).toBe("sans frais");
    const withFees = feesLabelFor(250_000, rules({ noFeesConfirmed: true, feesBps: 100 }));
    expect(withFees.kind).toBe("fees");
    expect(withFees.label).not.toMatch(/sans frais/i);
  });
  it("calcule les frais proportionnels + fixes", () => {
    expect(computeFeesCents(250_000, { feesBps: 150, feesFixedCents: 99 })).toBe(3_750 + 99);
    expect(feesLabelFor(250_000, rules({ feesBps: 150, feesFixedCents: 99 })).label).toMatch(/frais : 38,49 € \(selon contrat prestataire\)/);
  });
  it("les frais sont inclus dans l'échéancier", () => {
    const r = installmentEligibility({ totalCents: 100_000, countryCode: "FR", env: "test", settings: rules({ feesBps: 100 }) });
    expect(r.plans[0]!.totalWithFeesCents).toBe(101_000);
    expect(r.plans[0]!.firstCents + r.plans[0]!.otherCents * 2).toBe(101_000);
  });
});

describe("matrice d'éligibilité", () => {
  const ok = (over: Partial<InstallmentRules>, total = 250_000, env: "test" | "prod" = "test", country = "FR") => installmentEligibility({ totalCents: total, countryCode: country, env, settings: rules(over) });

  it("simulateur activé en test : éligible", () => {
    const r = ok({});
    expect(r.eligible).toBe(true);
    expect(r.plans).toHaveLength(1);
    expect(r.plans[0]!.count).toBe(3);
  });
  it("désactivé en test : non éligible", () => expect(ok({ enabledTest: false }).eligible).toBe(false));
  it("prestataire « none » : non éligible", () => expect(ok({ provider: "none" }).reasons.join()).toMatch(/aucun prestataire/));
  it("prod exige merchantEligible", () => {
    const r = ok({ provider: "stripe_alma", enabledProd: true, merchantEligible: false, installmentCounts: [3] }, 250_000, "prod");
    expect(r.eligible).toBe(false);
    expect(r.reasons.join()).toMatch(/merchantEligible/);
    expect(ok({ provider: "stripe_alma", enabledProd: true, merchantEligible: true }, 250_000, "prod").eligible).toBe(true);
  });
  it("prod : désactivé en prod ⇒ non éligible même si activé en test", () => expect(ok({ provider: "stripe_alma", enabledTest: true, enabledProd: false, merchantEligible: true }, 250_000, "prod").eligible).toBe(false));
  it("le simulateur n'est jamais éligible en prod", () => expect(ok({ enabledProd: true, merchantEligible: true }, 250_000, "prod").eligible).toBe(false));
  it("bornes des réglages", () => {
    expect(ok({}, 4_999).eligible).toBe(false);
    expect(ok({}, 5_000).eligible).toBe(true);
    expect(ok({}, 800_000).eligible).toBe(true);
    expect(ok({}, 800_001).eligible).toBe(false);
  });
  it("Klarna FR : 3 fois de 1 € à 3 000 € quel que soit le maximum des réglages", () => {
    const k = { provider: "stripe_klarna", minCents: 100, maxCents: 300_000 };
    expect(ok(k, 300_000).eligible).toBe(true);
    expect(ok({ ...k, maxCents: 900_000 }, 300_001).eligible).toBe(false);
    expect(ok({ ...k, installmentCounts: [4] }, 200_000).eligible).toBe(false);
  });
  it("Alma : 2/3/4 fois de 50 € à 5 000 €", () => {
    const a = { provider: "stripe_alma", installmentCounts: [2, 3, 4], maxCents: 500_000 };
    expect(ok(a, 4_999).eligible).toBe(false);
    expect(ok(a, 500_000).plans.map((p) => p.count)).toEqual([2, 3, 4]);
    expect(ok({ ...a, maxCents: 900_000 }, 600_000).eligible).toBe(false);
    expect(ok({ ...a, countries: ["FR", "DE"] }, 200_000, "test", "DE").reasons.join()).toMatch(/non accepté par Alma/);
  });
  it("pays hors réglages et devise non EUR", () => {
    expect(ok({}, 250_000, "test", "BE").eligible).toBe(false);
    expect(installmentEligibility({ totalCents: 250_000, countryCode: "FR", env: "test", currency: "USD", settings: rules() }).eligible).toBe(false);
    expect(ok({ currency: "CHF" }).eligible).toBe(false);
  });
  it("montant invalide", () => { expect(ok({}, 0).eligible).toBe(false); expect(ok({}, -10).eligible).toBe(false); });
});

describe("validation des réglages (contrôle serveur)", () => {
  it("enabledProd impossible avec none/simulateur ou sans compte validé", () => {
    expect(validateInstallmentRules(rules({ enabledProd: true, merchantEligible: true })).join()).toMatch(/production impossible sans prestataire réel/);
    expect(validateInstallmentRules(rules({ provider: "none", enabledProd: true, merchantEligible: true })).join()).toMatch(/production impossible/);
    expect(validateInstallmentRules(rules({ provider: "stripe_alma", enabledProd: true, merchantEligible: false, maxCents: 500_000 })).join()).toMatch(/compte marchand/);
    expect(validateInstallmentRules(rules({ provider: "stripe_alma", enabledProd: true, merchantEligible: true, maxCents: 500_000 }))).toEqual([]);
  });
  it("bornes et échéances cohérentes avec le prestataire", () => {
    expect(validateInstallmentRules(rules({ provider: "stripe_klarna", maxCents: 400_000 })).join()).toMatch(/maximum supérieur/);
    expect(validateInstallmentRules(rules({ provider: "stripe_klarna", maxCents: 300_000, installmentCounts: [4] })).join()).toMatch(/ne propose que/);
    expect(validateInstallmentRules(rules({ minCents: 10, maxCents: 5 })).join()).toMatch(/incohérentes/);
  });
  it("« sans frais confirmé » incompatible avec des frais", () => expect(validateInstallmentRules(rules({ noFeesConfirmed: true, feesBps: 50 })).join()).toMatch(/incompatible/));
});
