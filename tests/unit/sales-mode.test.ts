import { describe, expect, it } from "vitest";
import { salesModeFrom } from "@/server/payment/mode";

describe("mode d'encaissement", () => {
  it("simulateur seulement hors site public", () => {
    expect(salesModeFrom({})).toBe("demo");
    expect(salesModeFrom({ PAYMENT_PROVIDER: "demo", SITE_INDEXABLE: "false" })).toBe("demo");
    expect(salesModeFrom({ PAYMENT_PROVIDER: "demo", SITE_INDEXABLE: "true" })).toBe("disabled");
    expect(salesModeFrom({ SITE_INDEXABLE: "true" })).toBe("disabled");
  });
  it("Stripe exige la clé secrète et le secret de webhook, sinon aucun encaissement (jamais de repli sur le simulateur)", () => {
    expect(salesModeFrom({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test_x", STRIPE_WEBHOOK_SECRET: "whsec_x", SITE_INDEXABLE: "true" })).toBe("stripe");
    expect(salesModeFrom({ PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test_x" })).toBe("disabled");
    expect(salesModeFrom({ PAYMENT_PROVIDER: "stripe" })).toBe("disabled");
  });
  it("valeur explicite « disabled » ou inconnue : fermé", () => {
    expect(salesModeFrom({ PAYMENT_PROVIDER: "disabled" })).toBe("disabled");
    expect(salesModeFrom({ PAYMENT_PROVIDER: "autre" })).toBe("disabled");
  });
});
