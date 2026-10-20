"use server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { ingestPaymentEvent } from "@/server/payment";
import { getInstallmentSettings, validateInstallmentRules } from "@/server/payment/installments";
import { INSTALLMENT_PROVIDERS } from "@/server/payment/installments-rules";
import { actorOf, back, fields, firstError, zBool, zEuros, zInt, zOpt, zOptEuros, zReq } from "@/server/admin/form";

const PATH = "/admin/paiement";

const list = (re: RegExp, msg: string) => z.preprocess((v) => String(v ?? ""), z.string()).transform((v, ctx) => {
  const items = v.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
  if (items.some((x) => !re.test(x))) { ctx.addIssue({ code: "custom", message: msg }); return z.NEVER; }
  return items;
});

const schema = z.object({
  provider: z.enum(INSTALLMENT_PROVIDERS as unknown as [string, ...string[]]),
  enabledTest: zBool,
  enabledProd: zBool,
  merchantEligible: zBool,
  merchantNote: zOpt(500),
  merchantDate: zOpt(10).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date de validation : AAAA-MM-JJ"),
  min: zEuros,
  max: zEuros,
  countries: list(/^[A-Za-z]{2}$/, "Pays : codes ISO à 2 lettres séparés par des virgules").transform((a) => [...new Set(a.map((c) => c.toUpperCase()))]),
  installmentCounts: list(/^\d{1,2}$/, "Échéances : entiers séparés par des virgules").transform((a) => [...new Set(a.map(Number))].sort((x, y) => x - y)),
  feesBps: zInt(0, 5000),
  feesFixed: zEuros,
  feesLabel: zOpt(120),
  noFeesConfirmed: zBool,
  termsUrl: zOpt(500),
});

/** Enregistre les réglages du paiement fractionné (contrôles serveur + journal d'audit). */
export async function updateInstallmentSettingsAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const parsed = schema.safeParse(fields(formData));
  if (!parsed.success) back(PATH, firstError(parsed.error), "err");
  const d = parsed.data;
  const data = { provider: d.provider, enabledTest: d.enabledTest, enabledProd: d.enabledProd, merchantEligible: d.merchantEligible, minCents: d.min, maxCents: d.max, countries: d.countries, currency: "EUR", installmentCounts: d.installmentCounts, feesBps: d.feesBps, feesFixedCents: d.feesFixed, feesLabel: d.feesLabel ?? "", noFeesConfirmed: d.noFeesConfirmed, termsUrl: d.termsUrl };
  const errors = validateInstallmentRules(data);
  if (d.merchantEligible && !d.merchantNote && !d.merchantDate) errors.push("indiquez la date ou la référence de validation du compte marchand");
  if (errors.length) back(PATH, `Réglages refusés : ${errors.join(" ; ")}.`, "err");
  const before = await getInstallmentSettings();
  await prisma.installmentSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  // La note / date de validation marchand est conservée dans le journal d'audit (pas de colonne dédiée).
  await audit({ ...actorOf(session), action: "installments.settings", entity: "InstallmentSettings", entityId: "1", before, after: { ...data, merchantNote: d.merchantNote, merchantDate: d.merchantDate } });
  back(PATH, "Réglages du paiement fractionné enregistrés.");
}

/** Remboursement SIMULÉ d'un paiement du simulateur de paiement fractionné (événement `refund_succeeded`). */
export async function simulateInstallmentsRefundAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = z.object({ paymentId: zReq(64), amount: zOptEuros }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/commandes", firstError(parsed.error), "err");
  const payment = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId }, include: { refunds: { where: { status: "SUCCEEDED" } } } });
  if (!payment) back("/admin/commandes", "Paiement introuvable", "err");
  const path = `/admin/commandes/${payment.orderId}`;
  if (payment.provider !== "INSTALLMENTS_SIM") back(path, "Le remboursement simulé n'est possible que pour un paiement du simulateur. Remboursez via le tableau de bord du prestataire.", "err");
  if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") back(path, `Ce paiement n'est pas remboursable (statut ${payment.status}).`, "err");
  const already = payment.refunds.reduce((s, r) => s + r.amountCents, 0);
  const remaining = payment.amountCents - already;
  const amountCents = parsed.data.amount ?? remaining;
  if (amountCents <= 0 || amountCents > remaining) back(path, `Montant invalide (reste remboursable : ${(remaining / 100).toFixed(2)} €).`, "err");
  const eventId = `evt_refund_${randomBytes(12).toString("hex")}`;
  const res = await ingestPaymentEvent({ provider: "INSTALLMENTS_SIM", eventId, type: "instsim.refund.succeeded", normalized: "refund_succeeded", providerRef: payment.providerRef, orderId: payment.orderId, amountCents, refundRef: `re_sim_${randomBytes(8).toString("hex")}`, detail: "remboursement simulé (administration)", payload: { simulated: true, paymentId: payment.id, amountCents, initiatedBy: "admin" } });
  await audit({ ...actorOf(session), action: "order.refund.installments_sim", entity: "Order", entityId: payment.orderId, before: { paymentStatus: payment.status, refundedCents: already }, after: { amountCents, outcome: res.outcome, eventId } });
  back(path, `Remboursement simulé enregistré (${res.outcome}).`);
}
