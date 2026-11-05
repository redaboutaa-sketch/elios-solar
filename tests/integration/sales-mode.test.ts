import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { addLine, CartError } from "@/server/cart/service";
import { createOrderFromCart, OrderError } from "@/server/order/service";
import { createOrderFromQuote } from "@/server/order/quote-order";
import { evaluateInput } from "@/server/configuration/service";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { ADDRESS, cartWith, cleanup, guest, standardInput } from "./helpers";

/** Encaissement fermé (site public sans Stripe raccordé) : aucun panier, aucune commande, aucun paiement de devis. */
const saved = { PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER, SITE_INDEXABLE: process.env.SITE_INDEXABLE };
const restore = () => { for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } };

beforeEach(async () => { restore(); await cleanup(); invalidateCatalogCache(); });
afterEach(restore);
afterAll(async () => { restore(); await cleanup(); await prisma.quote.deleteMany({ where: { email: { endsWith: "@sales-mode.invalid" } } }); await prisma.$disconnect(); });

describe("site public sans prestataire de paiement raccordé", () => {
  it("simulateur refusé sur un site indexable : ajout au panier et commande impossibles, configuration toujours évaluée", async () => {
    const g = guest();
    await cartWith(g, [standardInput()]); // panier préparé en mode démonstration
    process.env.PAYMENT_PROVIDER = "demo";
    process.env.SITE_INDEXABLE = "true";
    await expect(addLine({ guestKey: g }, standardInput())).rejects.toBeInstanceOf(CartError);
    await expect(createOrderFromCart({ owner: { guestKey: g }, email: "x@sales-mode.invalid", shippingAddress: ADDRESS })).rejects.toBeInstanceOf(OrderError);
    const r = await evaluateInput(standardInput());
    expect(r.purchasable).toBe(false);
    expect(await prisma.order.count({ where: { email: "x@sales-mode.invalid" } })).toBe(0);
  });
  it("Stripe incomplet : jamais de repli sur le paiement simulé", async () => {
    process.env.PAYMENT_PROVIDER = "stripe";
    delete process.env.STRIPE_SECRET_KEY;
    const q = await prisma.quote.create({ data: { number: `T-${Date.now()}`, kind: "general", email: "q@sales-mode.invalid", firstName: "Test", lastName: "Mode", status: "ACCEPTED", proposedTotalCents: 100_000, snapshot: {} } as never });
    await expect(createOrderFromQuote(q.id, { vatRateBps: 2000 })).rejects.toThrow(/paiement en ligne n'est pas ouvert/);
  });
});
