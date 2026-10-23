/** Retour client du 2026-10-21 : guides en brouillon jusqu'à validation, moyens de paiement réels, emplacements préparés. */
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { guideStatuses, isPublished, setGuideStatus } from "@/server/guides/status";
import { paymentMethods } from "@/server/payment/methods";
import { seedHeliostores } from "@/server/catalog/heliostores-seed";

const BY = { email: "test:retour-client" };
afterAll(async () => { await prisma.installGuideStatus.deleteMany({}); });

describe("guides d'installation", () => {
  it("brouillon par défaut ; publication refusée sans validation technique ; guide sans étape jamais publiable", async () => {
    expect((await guideStatuses()).get("helio-riviera-installation")?.status).toBe("DRAFT");
    await expect(setGuideStatus("helio-riviera-installation", "PUBLISHED", BY)).rejects.toThrow(/validé techniquement/);
    await expect(setGuideStatus("helio-riviera-installation", "VALIDATED", BY)).rejects.toThrow(/Indiquez qui/);
    await setGuideStatus("helio-riviera-installation", "VALIDATED", { ...BY, validator: "Responsable technique (test)" });
    await setGuideStatus("helio-riviera-installation", "PUBLISHED", BY);
    expect(await isPublished("helio-riviera-installation")).toBe(true);
    await setGuideStatus("helio-riviera-installation", "DRAFT", BY);
    expect(await isPublished("helio-riviera-installation")).toBe(false);
    await setGuideStatus("helio-horizon-installation", "VALIDATED", { ...BY, validator: "Responsable technique (test)" });
    await expect(setGuideStatus("helio-horizon-installation", "PUBLISHED", BY)).rejects.toThrow(/sans étape/);
  });
});

describe("moyens de paiement", () => {
  it("préproduction : aucun moyen présenté comme actif sans prestataire réel ; acompte et virement envisagés", async () => {
    const m = await paymentMethods();
    if (process.env.PAYMENT_PROVIDER !== "stripe") expect(m.find((x) => x.code === "card")?.state).toBe("simulated");
    expect(m.find((x) => x.code === "quote_deposit")?.state).toBe("planned");
    expect(m.find((x) => x.code === "transfer")?.state).toBe("planned");
    expect(JSON.stringify(m.map((x) => x.text))).not.toMatch(/\d+\s?%|mensualit|gratuit/i);
  });
});

describe("réalisations et production", () => {
  it("emplacements préparés en brouillon, jamais publiés ; seed idempotent", async () => {
    await seedHeliostores(prisma);
    await seedHeliostores(prisma);
    const rows = await prisma.realisation.findMany({ where: { placeholder: true } });
    expect(rows.map((r) => r.kind).sort()).toEqual(["PRODUCTION", "PRODUCTION", "PRODUCTION", "REALISATION", "REALISATION", "REALISATION"]);
    expect(rows.every((r) => !r.published && !r.mediaId)).toBe(true);
  });
  it("historique des noms : le seed n'écrase pas un nom modifié dans l'administration", async () => {
    const f = await prisma.productFamily.findUniqueOrThrow({ where: { slug: "helio-ombra" } });
    await prisma.productFamily.update({ where: { id: f.id }, data: { name: "Nom provisoire de test", commercialEditedAt: new Date() } });
    try {
      await seedHeliostores(prisma);
      const after = await prisma.productFamily.findUniqueOrThrow({ where: { id: f.id } });
      expect(after.name).toBe("Nom provisoire de test");
      expect(after.supplierRef).toBe("REFLEKSOL 120 ZiiiP");
      expect(after.legacySlugs).toContain("screen-refleksol-120-ziiip");
    } finally {
      await prisma.productFamily.update({ where: { id: f.id }, data: { name: f.name, commercialEditedAt: null } });
    }
  });
});
