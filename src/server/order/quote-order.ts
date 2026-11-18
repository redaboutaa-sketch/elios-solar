import "server-only";
import { prisma } from "@/lib/prisma";
import { businessNumber } from "@/server/ids";
import { OrderError } from "./service";
import { onlineSalesEnabled } from "@/server/payment/mode";

/** Durée de validité d'une demande de paiement de devis sans date de validité (jours). */
const QUOTE_PAYMENT_DAYS = 30;

/**
 * Paiement d'un devis APPROUVÉ : crée (une seule fois) la commande à payer, au montant TTC fixé par un conseiller dans
 * le devis (`proposedTotalCents`) — jamais un montant envoyé par le navigateur ni recalculé d'une grille. Le taux de
 * TVA est celui que le conseiller indique. Le devis et sa configuration restent inchangés (instantané conservé).
 */
export async function createOrderFromQuote(quoteId: string, opts: { vatRateBps: number; label?: string }) {
  if (!onlineSalesEnabled()) throw new OrderError("Le paiement en ligne n'est pas ouvert sur cet environnement : le devis se règle hors ligne.", "sales_disabled");
  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) throw new OrderError("Devis introuvable.", "not_found");
  if (quote.status !== "ACCEPTED") throw new OrderError("Seul un devis accepté par le client peut être payé en ligne.", "quote_not_accepted");
  if (!quote.proposedTotalCents || quote.proposedTotalCents <= 0) throw new OrderError("Indiquez d'abord le montant TTC du devis.", "quote_amount");
  if (quote.validUntil && quote.validUntil < new Date()) throw new OrderError("Le devis n'est plus valable : prolongez sa validité avant d'ouvrir le paiement.", "quote_expired");
  if (!Number.isInteger(opts.vatRateBps) || opts.vatRateBps < 0 || opts.vatRateBps > 3000) throw new OrderError("Taux de TVA invalide.", "vat");
  const existing = await prisma.order.findFirst({ where: { quoteId, status: { in: ["PENDING_PAYMENT", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } }, include: { payments: true } });
  if (existing) return { order: existing, created: false };
  const total = quote.proposedTotalCents;
  const net = Math.round((total * 10_000) / (10_000 + opts.vatRateBps));
  const address = { firstName: quote.firstName, lastName: quote.lastName, postalCode: quote.postalCode ?? "", countryCode: "FR", phone: quote.phone ?? "" };
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        number: businessNumber("CMD"),
        userId: quote.userId ?? null,
        email: quote.email,
        goodsCents: total,
        taxCents: total - net,
        totalCents: total,
        shippingAddress: address as never,
        billingAddress: address as never,
        delivery: { countryCode: "FR", postalCode: quote.postalCode ?? null, shippingIncluded: true, shippingLabel: "selon le devis" } as never,
        isDemo: (process.env.PAYMENT_PROVIDER ?? "demo") !== "stripe",
        containsDemoData: quote.containsDemoData,
        quoteId: quote.id,
        expiresAt: quote.validUntil ?? new Date(Date.now() + QUOTE_PAYMENT_DAYS * 86_400_000),
      },
    });
    await tx.orderLine.create({ data: { orderId: created.id, kind: "base", label: `Devis ${quote.number}${opts.label ? ` — ${opts.label}` : ""}`, qty: 1, unitGrossCents: total, totalGrossCents: total, taxRateBps: opts.vatRateBps, configurationSnapshot: (quote.snapshot ?? undefined) as never, sortOrder: 0 } });
    return created;
  });
  return { order, created: true };
}

/** Accès client au paiement d'une commande : propriétaire, ou compte connecté avec l'adresse e-mail de la commande. */
export async function orderForPayer(orderId: string, viewer: { userId?: string | null; email?: string | null; guestKey?: string | null }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { lines: { orderBy: { sortOrder: "asc" } }, payments: { orderBy: { createdAt: "desc" } } } });
  if (!order) return null;
  if (viewer.userId && order.userId === viewer.userId) return order;
  if (viewer.email && order.email === viewer.email.trim().toLowerCase()) return order;
  if (!order.userId && viewer.guestKey && order.guestKey === viewer.guestKey) return order;
  return null;
}
