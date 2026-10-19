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
