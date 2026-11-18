import { prisma } from "@/lib/prisma";
import { randomBytes } from "node:crypto";
import type { ConfigurationInput, PergolaStandardInput } from "@/domain/types";
import { addLine, setCartDelivery } from "@/server/cart/service";
import { createOrderFromCart } from "@/server/order/service";
import { startPayment } from "@/server/payment";

export const guest = () => randomBytes(12).toString("hex");

export function standardInput(over: Partial<PergolaStandardInput> = {}): PergolaStandardInput {
  return { kind: "pergola_standard", familySlug: "pergola-solis", mounting: "freestanding", dimensionCode: "3x4", finishCode: "ANTHRACITE", segments: {}, options: [], installation: "self", delivery: { countryCode: "FR" }, ...over };
}

export const ADDRESS = { firstName: "Test", lastName: "Client", line1: "1 rue des Tests", postalCode: "69000", city: "Lyon", countryCode: "FR", phone: "0600000000" };

export async function cartWith(guestKey: string, inputs: ConfigurationInput[]) {
  for (const i of inputs) await addLine({ guestKey }, i);
  await setCartDelivery({ guestKey }, { countryCode: "FR", postalCode: "69000" });
}

export async function orderFor(guestKey: string, email = `${guestKey.slice(0, 6)}@test.invalid`) {
  const order = await createOrderFromCart({ owner: { guestKey }, email, shippingAddress: ADDRESS });
  const { payment } = await startPayment(order.id);
  return { order, payment };
}

export async function setStock(sku: string, qty: number) {
  await prisma.variant.update({ where: { sku }, data: { stockMode: "STOCK", stockQty: qty, reservedQty: 0 } });
  await prisma.stockReservation.deleteMany({ where: { variant: { sku } } });
}

export async function cleanup() {
  await prisma.paymentEvent.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.stockReservation.deleteMany({});
  await prisma.orderLine.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartLine.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.quote.deleteMany({});
  await prisma.configuration.deleteMany({});
  await prisma.emailOutbox.deleteMany({});
  await prisma.contactRequest.deleteMany({});
}

export interface TestGridCell { familySlug: string; variantKey: string; dimAmm: number; widthMinMm: number; widthMaxMm: number; amountMinor: number; dimAKey?: string }

/**
 * Publie des grilles SYNTHÉTIQUES (montants fictifs) dans la base de test, une par famille × variante × nature,
 * après avoir mis de côté les versions publiées des mêmes contextes ; `restore()` remet l'état initial.
 */
export async function publishTestGrids(cells: TestGridCell[], opts: { nature?: "SALE" | "PURCHASE"; currency?: string; taxBasis?: "HT" | "TTC" } = {}) {
  const nature = opts.nature ?? "SALE";
  const groups = new Map<string, TestGridCell[]>();
  for (const c of cells) { const k = `${c.familySlug}|${c.variantKey}`; groups.set(k, [...(groups.get(k) ?? []), c]); }
  const parked: { id: string; status: "ACTIVE" }[] = [];
  const created: string[] = [];
  const since = new Date(Date.now() - 1000);
  for (const [k, cs] of groups) {
    const [familySlug, variantKey] = k.split("|") as [string, string];
    const live = await prisma.supplierPriceList.findMany({ where: { scope: "GRID", status: "ACTIVE", familySlug, variantKey, nature }, select: { id: true } });
    for (const l of live) { await prisma.supplierPriceList.update({ where: { id: l.id }, data: { status: "ARCHIVED" } }); parked.push({ id: l.id, status: "ACTIVE" }); }
    // même lignée que les grilles réelles (famille × variante × colonne), version suivante
    const sourceKey = `grid:${familySlug}:${variantKey || "_"}:PRIX_FINAL`;
    const last = await prisma.supplierPriceList.findFirst({ where: { sourceKey }, orderBy: { version: "desc" }, select: { version: true } });
    const list = await prisma.supplierPriceList.create({ data: { scope: "GRID", sourceKey, version: (last?.version ?? 0) + 1, label: "test", sourceFile: "synthetique", sourceSha256: "", status: "ACTIVE", familySlug, variantKey, amountRole: "PRIX_FINAL", nature, currency: opts.currency ?? "EUR", taxBasis: opts.taxBasis ?? "HT", publishedAt: new Date(), validFrom: new Date(Date.now() - 1000) } });
    created.push(list.id);
    await prisma.supplierPriceRow.createMany({ data: cs.map((c) => ({ listId: list.id, familySlug, variantKey, kind: "GRID", dimAKey: c.dimAKey ?? "projection", dimAmm: c.dimAmm, widthMinMm: c.widthMinMm, widthMaxMm: c.widthMaxMm, amountMinor: c.amountMinor, amountRole: "PRIX_FINAL", sourceRef: "test", status: "OK" as const })) });
  }
  return {
    ids: created,
    /** supprime les versions créées depuis (y compris celles publiées par le test dans ces contextes) */
    async restore() {
      await prisma.supplierPriceList.deleteMany({ where: { OR: [{ id: { in: created } }, ...[...groups.keys()].map((k) => { const [familySlug, variantKey] = k.split("|") as [string, string]; return { scope: "GRID" as const, familySlug, variantKey, createdAt: { gte: since } }; })] } });
      for (const p of parked) await prisma.supplierPriceList.update({ where: { id: p.id }, data: { status: p.status } });
    },
  };
}
