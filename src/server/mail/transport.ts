import nodemailer from "nodemailer";
import { renderTemplate } from "@/server/mail/templates";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface MailMessage { to: string; subject: string; html: string; text: string }

export interface MailTransport { send(message: MailMessage): Promise<{ id: string }> }

/**
 * Fournisseurs : « smtp » (envoi réel), « log » (développement : journalisé et marqué envoyé, rien ne part),
 * « hold » (aucun fournisseur disponible : les messages restent en file, non envoyés, visibles dans Administration → E-mails,
 * et partiront dès qu'un SMTP sera configuré). Ne jamais utiliser « log » sur un environnement public.
 */
export const mailProvider = () => process.env.MAIL_PROVIDER ?? "log";
export const mailDeliveryReal = () => mailProvider() === "smtp" && !!process.env.SMTP_HOST;

export function createTransport(): MailTransport {
  const provider = process.env.MAIL_PROVIDER ?? "log";
  if (provider === "smtp") {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "127.0.0.1",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    return {
      async send(m) {
        const info = await transporter.sendMail({ from: process.env.MAIL_FROM ?? "no-reply@localhost", to: m.to, subject: m.subject, html: m.html, text: m.text });
        return { id: info.messageId };
      },
    };
  }
  return {
    async send(m) {
      logger.info({ to: m.to, subject: m.subject }, "mail (log provider)");
      return { id: `log-${Date.now()}` };
    },
  };
}

const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

/**
 * Seuil d'envoi (`MAIL_SEND_AFTER`, date ISO) : les messages mis en file avant ce seuil (période sans SMTP, tests)
 * ne partent jamais automatiquement au raccordement d'un SMTP. « Réessayer » dans l'administration repousse leur
 * prochain essai après le seuil et les libère un par un ; « Abandonner » les écarte.
 */
export function mailSendAfter(): Date | null {
  const raw = process.env.MAIL_SEND_AFTER;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Traite les e-mails en attente. Retourne le nombre envoyés / échoués. Idempotent (statuts). */
export async function processOutbox(transport: MailTransport = createTransport(), limit = 20) {
  if (mailProvider() === "hold") return { sent: 0, failed: 0, pending: 0, held: true };
  const now = new Date();
  const cut = mailSendAfter();
  const pending = await prisma.emailOutbox.findMany({ where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: now, ...(cut ? { gte: cut } : {}) } }, orderBy: { createdAt: "asc" }, take: limit });
  let sent = 0, failed = 0;
  for (const item of pending) {
    const claimed = await prisma.emailOutbox.updateMany({ where: { id: item.id, status: item.status, attempts: item.attempts }, data: { attempts: { increment: 1 } } });
    if (claimed.count === 0) continue; // pris par un autre worker
    try {
      const rendered = renderTemplate(item.template, item.payload as Record<string, unknown>);
      await transport.send({ to: item.toEmail, subject: item.subject, ...rendered });
      await prisma.emailOutbox.update({ where: { id: item.id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent += 1;
    } catch (err) {
      failed += 1;
      const attempts = item.attempts + 1;
      const dead = attempts >= BACKOFF_MINUTES.length;
      const delay = BACKOFF_MINUTES[Math.min(attempts, BACKOFF_MINUTES.length - 1)] ?? 60;
      await prisma.emailOutbox.update({ where: { id: item.id }, data: { status: dead ? "DEAD" : "FAILED", lastError: String(err).slice(0, 500), nextAttemptAt: new Date(Date.now() + delay * 60_000) } });
      logger.warn({ id: item.id, attempts, err: String(err) }, "échec d'envoi e-mail");
    }
  }
  return { sent, failed, pending: pending.length };
}
