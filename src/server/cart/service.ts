import { prisma } from "@/lib/prisma";
import { evaluate, resolveShipping } from "@/domain/engine";
import type { CatalogSnapshot, ConfigurationInput, DeliveryInput, EvaluationResult, Issue } from "@/domain/types";
import { loadCatalog } from "@/server/catalog/load";
import type { Cart, CartLine } from "@/generated/prisma/client";
import { ONLINE_SALES_CLOSED, onlineSalesEnabled } from "@/server/payment/mode";

export type Owner = { userId?: string | null; guestKey?: string | null };

export async function findActiveCart(owner: Owner) {
  if (owner.userId) {
    const c = await prisma.cart.findFirst({ where: { userId: owner.userId, status: "ACTIVE" }, include: { lines: { orderBy: { createdAt: "asc" } } } });
    if (c) return c;
  }
  if (owner.guestKey) {
    return prisma.cart.findFirst({ where: { guestKey: owner.guestKey, userId: null, status: "ACTIVE" }, include: { lines: { orderBy: { createdAt: "asc" } } } });
  }
  return null;
}

export async function getOrCreateCart(owner: Owner) {
  const existing = await findActiveCart(owner);
  if (existing) return existing;
  return prisma.cart.create({ data: { userId: owner.userId ?? null, guestKey: owner.guestKey ?? null }, include: { lines: true } });
}

/** Fusion du panier invité dans le panier du compte à la connexion. */
export async function mergeGuestCart(userId: string, guestKey: string) {
  const guest = await prisma.cart.findFirst({ where: { guestKey, userId: null, status: "ACTIVE" }, include: { lines: true } });
  if (!guest) return;
  const user = await prisma.cart.findFirst({ where: { userId, status: "ACTIVE" } });
  if (!user) {
    await prisma.cart.update({ where: { id: guest.id }, data: { userId } });
    return;
  }
  await prisma.cartLine.updateMany({ where: { cartId: guest.id }, data: { cartId: user.id } });
  await prisma.cart.update({ where: { id: guest.id }, data: { status: "ABANDONED" } });
}

export class CartError extends Error {
  constructor(message: string, readonly issues: Issue[] = []) {
    super(message);
    this.name = "CartError";
  }
}

export async function addLine(owner: Owner, input: ConfigurationInput, configurationId?: string | null) {
  const catalog = await loadCatalog();
  const stripped = stripDelivery(input);
  const result = evaluate(catalog, { ...stripped, delivery: { countryCode: "FR", postalCode: "00000" } } as ConfigurationInput);
  if (!onlineSalesEnabled()) throw new CartError(ONLINE_SALES_CLOSED);
  if (!result.purchasable) throw new CartError("Cette configuration ne peut pas être ajoutée au panier.", result.issues.filter((i) => i.severity !== "info"));
  const cart = await getOrCreateCart(owner);
  const line = await prisma.cartLine.create({ data: { cartId: cart.id, configurationId: configurationId ?? null, input: stripped as never, qty: 1 } });
  // le code postal saisi dans le configurateur est repris pour le panier s'il n'en a pas encore
  const postal = input.delivery?.postalCode?.trim();
  const delivery = !cart.delivery && postal ? ({ countryCode: input.delivery.countryCode ?? "FR", postalCode: postal } as never) : undefined;
  await prisma.cart.update({ where: { id: cart.id }, data: { updatedAt: new Date(), ...(delivery ? { delivery } : {}) } });
  return { cart, line };
}

/** Remplace l'entrée d'une ligne (modification depuis le configurateur) après réévaluation serveur. */
export async function replaceLine(owner: Owner, lineId: string, input: ConfigurationInput, configurationId?: string | null) {
  const cart = await findActiveCart(owner);
  const line = cart?.lines.find((l) => l.id === lineId);
  if (!cart || !line) throw new CartError("Ligne introuvable.");
  const catalog = await loadCatalog();
  const stripped = stripDelivery(input);
  const result = evaluate(catalog, { ...stripped, delivery: { countryCode: "FR", postalCode: "00000" } } as ConfigurationInput);
  if (!onlineSalesEnabled()) throw new CartError(ONLINE_SALES_CLOSED);
  if (!result.purchasable) throw new CartError("Cette configuration ne peut pas être enregistrée dans le panier.", result.issues.filter((i) => i.severity !== "info"));
  return prisma.cartLine.update({ where: { id: lineId }, data: { input: stripped as never, configurationId: configurationId ?? line.configurationId } });
}

export async function getLineForOwner(owner: Owner, lineId: string) {
  const cart = await findActiveCart(owner);
  return cart?.lines.find((l) => l.id === lineId) ?? null;
}

export async function updateLineQty(owner: Owner, lineId: string, qty: number) {
  const cart = await findActiveCart(owner);
  const line = cart?.lines.find((l) => l.id === lineId);
  if (!cart || !line) throw new CartError("Ligne introuvable.");
  if (qty <= 0) return prisma.cartLine.delete({ where: { id: lineId } });
  if (qty > 10) throw new CartError("Quantité maximale : 10.");
  return prisma.cartLine.update({ where: { id: lineId }, data: { qty } });
}

export async function removeLine(owner: Owner, lineId: string) {
  const cart = await findActiveCart(owner);
  if (!cart?.lines.some((l) => l.id === lineId)) throw new CartError("Ligne introuvable.");
  await prisma.cartLine.delete({ where: { id: lineId } });
}

export async function setCartDelivery(owner: Owner, delivery: DeliveryInput, promotionCode?: string | null) {
  const cart = await getOrCreateCart(owner);
  return prisma.cart.update({ where: { id: cart.id }, data: { delivery: delivery as never, promotionCode: promotionCode === undefined ? cart.promotionCode : promotionCode } });
}

function stripDelivery<T extends ConfigurationInput>(input: T): T {
  return { ...input, delivery: { countryCode: input.delivery?.countryCode ?? "FR" } };
}

/** Mention de livraison d'un panier de systèmes HELIOSTORES (structure seule). */
export const SYSTEM_DELIVERY_LABEL = "Livraison et pose non comprises : organisées avec un conseiller après la commande";

export interface CartLineEvaluation {
  line: CartLine;
  input: ConfigurationInput;
  result: EvaluationResult;
  lineTotalCents: number;
}

export interface CartEvaluation {
  cart: Cart & { lines: CartLine[] };
  lines: CartLineEvaluation[];
  goodsCents: number;
  installationCents: number;
  discountCents: number;
  shippingCents: number | null;
  shippingLabel: string | null;
  /** not_included : panier de systèmes HELIOSTORES, livraison et pose organisées avec un conseiller (hors commande en ligne) */
  shippingStatus: "ok" | "postal_code_required" | "quote" | "unsupported" | "not_included";
  taxCents: number;
  totalCents: number;
  isFinal: boolean;
  purchasable: boolean;
  /** toutes les lignes sont des systèmes HELIOSTORES (structure seule) */
  systemOnly: boolean;
  containsDemoData: boolean;
  delivery: DeliveryInput;
  catalogVersion: string;
}

/** Évaluation autoritaire du panier (prix recalculés depuis le catalogue courant). */
export async function evaluateCart(cart: Cart & { lines: CartLine[] }, catalogOverride?: CatalogSnapshot): Promise<CartEvaluation> {
  const catalog = catalogOverride ?? (await loadCatalog());
  const delivery = ((cart.delivery as DeliveryInput | null) ?? { countryCode: "FR" }) as DeliveryInput;
  const lines: CartLineEvaluation[] = cart.lines.map((line) => {
    const input = { ...(line.input as unknown as ConfigurationInput), promotionCode: cart.promotionCode ?? undefined, delivery: { countryCode: delivery.countryCode } } as ConfigurationInput;
    const result = evaluate(catalog, input);
    const perUnit = result.totals.goodsGrossCents + result.totals.installationGrossCents - result.totals.discountGrossCents;
    return { line, input, result, lineTotalCents: perUnit * line.qty };
  });
  const goodsCents = lines.reduce((s, l) => s + l.result.totals.goodsGrossCents * l.line.qty, 0);
  const installationCents = lines.reduce((s, l) => s + l.result.totals.installationGrossCents * l.line.qty, 0);
  const discountCents = lines.reduce((s, l) => s + l.result.totals.discountGrossCents * l.line.qty, 0);
  // systèmes HELIOSTORES : la commande en ligne porte sur la structure seule ; aucune règle de livraison n'est établie
  // pour ces produits (les règles du catalogue sont celles de l'ancienne démonstration)
  const systemOnly = lines.length > 0 && lines.every((l) => l.input.kind === "system");
  const ship = systemOnly ? ({ status: "not_included" } as const) : resolveShipping(catalog, delivery);
  const shippingCents = ship.status === "ok" ? ship.rule.priceCents : ship.status === "not_included" ? 0 : null;
  const shippingLabel = ship.status === "ok" || ship.status === "quote" ? ship.rule.label : ship.status === "not_included" ? SYSTEM_DELIVERY_LABEL : null;
  const subtotal = goodsCents + installationCents - discountCents;
  const taxCents = lines.reduce((s, l) => s + l.result.totals.taxCents * l.line.qty, 0) + Math.round(((shippingCents ?? 0) * catalog.taxRateBps) / (10_000 + catalog.taxRateBps));
  const purchasable = lines.length > 0 && lines.every((l) => l.result.purchasable);
  return {
    cart, lines, goodsCents, installationCents, discountCents, shippingCents, shippingLabel, shippingStatus: ship.status, taxCents,
    totalCents: subtotal + (shippingCents ?? 0),
    isFinal: purchasable && shippingCents !== null,
    purchasable,
    systemOnly,
    containsDemoData: lines.some((l) => l.result.containsDemoData),
    delivery,
    catalogVersion: catalog.version,
  };
}
