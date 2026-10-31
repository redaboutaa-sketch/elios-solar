import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/mail/outbox";
import { processOutbox, type MailTransport } from "@/server/mail/transport";
import { createQuote } from "@/server/quote/service";
import { evaluateInput, getConfigurationWithRevalidation, saveConfiguration, setShareRevoked, isOwner } from "@/server/configuration/service";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { cleanup, guest, standardInput } from "./helpers";

beforeEach(async () => { await cleanup(); invalidateCatalogCache(); });
afterAll(async () => { await cleanup(); await prisma.$disconnect(); });

describe("file d'e-mails", () => {
  it("réessaie après une indisponibilité du transport, sans doublon", async () => {
    await enqueueEmail({ to: "x@test.invalid", subject: "s", template: "contact-ack", payload: { name: "X" }, dedupeKey: "k1" });
    await enqueueEmail({ to: "x@test.invalid", subject: "s", template: "contact-ack", payload: { name: "X" }, dedupeKey: "k1" });
    expect(await prisma.emailOutbox.count()).toBe(1);
    const failing: MailTransport = { async send() { throw new Error("SMTP indisponible"); } };
    const r1 = await processOutbox(failing);
    expect(r1).toMatchObject({ sent: 0, failed: 1 });
    const row = await prisma.emailOutbox.findFirstOrThrow();
    expect(row.status).toBe("FAILED");
    expect(row.attempts).toBe(1);
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    // pas encore l'heure : rien n'est retenté
    expect((await processOutbox(failing)).pending).toBe(0);
    await prisma.emailOutbox.update({ where: { id: row.id }, data: { nextAttemptAt: new Date() } });
    const sent: string[] = [];
    const working: MailTransport = { async send(m) { sent.push(m.to); return { id: "ok" }; } };
    expect(await processOutbox(working)).toMatchObject({ sent: 1, failed: 0 });
    expect(sent).toEqual(["x@test.invalid"]);
    expect((await prisma.emailOutbox.findFirstOrThrow()).status).toBe("SENT");
    expect((await processOutbox(working)).pending).toBe(0);
  });

  it("raccordement d'un SMTP : les messages antérieurs à MAIL_SEND_AFTER ne partent pas seuls, « Réessayer » les libère un par un", async () => {
    await enqueueEmail({ to: "ancien@test.invalid", subject: "s", template: "contact-ack", payload: { name: "A" }, dedupeKey: "old" });
    const old = await prisma.emailOutbox.findFirstOrThrow();
    await prisma.emailOutbox.update({ where: { id: old.id }, data: { createdAt: new Date(Date.now() - 3_600_000), nextAttemptAt: new Date(Date.now() - 3_600_000) } });
    process.env.MAIL_SEND_AFTER = new Date(Date.now() - 60_000).toISOString();
    try {
      await enqueueEmail({ to: "nouveau@test.invalid", subject: "s", template: "contact-ack", payload: { name: "N" }, dedupeKey: "new" });
      const sent: string[] = [];
      const working: MailTransport = { async send(m) { sent.push(m.to); return { id: "ok" }; } };
      await processOutbox(working);
      expect(sent).toEqual(["nouveau@test.invalid"]);
      expect((await prisma.emailOutbox.findUniqueOrThrow({ where: { id: old.id } })).status).toBe("PENDING");
      // équivalent de « Réessayer » : prochain essai maintenant, après le seuil
      await prisma.emailOutbox.update({ where: { id: old.id }, data: { nextAttemptAt: new Date() } });
      await processOutbox(working);
      expect(sent).toEqual(["nouveau@test.invalid", "ancien@test.invalid"]);
    } finally {
      delete process.env.MAIL_SEND_AFTER;
    }
  });
});

describe("devis", () => {
  it("persiste la demande sur mesure et notifie client et administrateur", async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = "admin@test.invalid";
    const input = { kind: "pergola_custom" as const, widthMm: 3500, lengthMm: 4500, heightMm: 2500, mounting: "wall" as const, finishCode: "WHITE", sides: { front: { closureFamilySlug: "paroi-vitree" } }, options: [], installation: "self" as const, delivery: { countryCode: "FR" } };
    const result = await evaluateInput(input);
    const q = await createQuote({ kind: "custom", firstName: "Ana", lastName: "Test", email: "ana@test.invalid", input, result }, { guestKey: guest() });
    expect(q.number).toMatch(/^DEV-\d{6}-[A-Z0-9]{6}$/);
    const stored = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } });
    expect((stored.snapshot as { input: typeof input }).input.widthMm).toBe(3500);
    expect((stored.snapshot as { deliveryNote?: string }).deliveryNote).toBe("Délai de livraison : entre 4 et 7 semaines selon le lieu de livraison.");
    const mails = await prisma.emailOutbox.findMany({ orderBy: { createdAt: "asc" } });
    expect(mails.map((m) => [m.toEmail, m.template])).toEqual([["ana@test.invalid", "quote-received"], ["admin@test.invalid", "quote-admin-notification"]]);
  });
});

describe("configurations sauvegardées", () => {
  it("revalide et signale un changement de prix ; un lien révoqué ne répond plus", async () => {
    const g = guest();
    const c = await saveConfiguration({ input: standardInput(), guestKey: g, title: "Mon projet" });
    const before = await getConfigurationWithRevalidation({ shareToken: c.shareToken });
    expect(before?.diff).toBeNull();
    const sku = (before!.result.lines[0]!.sku)!;
    const v = await prisma.variant.findUniqueOrThrow({ where: { sku } });
    await prisma.variant.update({ where: { sku }, data: { priceCents: v.priceCents + 12_300 } });
    invalidateCatalogCache();
    const after = await getConfigurationWithRevalidation({ shareToken: c.shareToken });
    expect(after?.diff?.priceChanged).toBe(true);
    expect(after!.result.totals.totalGrossCents - before!.result.totals.totalGrossCents).toBe(12_300);
    await prisma.variant.update({ where: { sku }, data: { priceCents: v.priceCents } });
    expect(isOwner(c, { guestKey: guest() })).toBe(false);
    await setShareRevoked(c.id, { guestKey: g }, true);
    expect(await getConfigurationWithRevalidation({ shareToken: c.shareToken })).toBeNull();
  });
});
