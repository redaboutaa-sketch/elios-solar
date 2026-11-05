import { describe, expect, it } from "vitest";
import { commercialContact } from "@/domain/commercial-contact";
import { DELIVERY_LEAD_TIME } from "@/domain/delivery";

describe("coordonnées commerciales publiques", () => {
  it("marque, localité et e-mail ; jamais le téléphone ni la rue des Réglages", () => {
    const settings = { addressLine1: "1 rue Exemple", phone: "+33 1 00 00 00 00", postalCode: "59650", city: "Villeneuve-d'Ascq", countryCode: "FR", contactEmail: "contact@example.test" };
    const c = commercialContact(settings, "HELIOSTORES");
    expect(c).toMatchObject({ name: "HELIOSTORES", locality: "59650 Villeneuve-d'Ascq, France", email: "contact@example.test" });
    expect(JSON.stringify(c)).not.toMatch(/rue Exemple|\+33/);
  });
  it("réglages vides : rien d'inventé", () => {
    expect(commercialContact(null, "HELIOSTORES")).toMatchObject({ locality: null, email: null });
  });
});

describe("délai de livraison", () => {
  it("formulation exacte fournie par le client", () => {
    expect(DELIVERY_LEAD_TIME).toBe("Délai de livraison : entre 4 et 7 semaines selon le lieu de livraison.");
  });
});
