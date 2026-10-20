import { formatEur } from "@/domain/money";

const brand = () => process.env.NEXT_PUBLIC_BRAND_NAME ?? "HELIOSTORES";
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

/** Couleurs HELIOSTORES (voir docs/heliostores/identite.md) — e-mails : styles en ligne uniquement. */
const C = { night: "#0b0f0d", green: "#44664d", page: "#f7f8f5", ink: "#1a201c", border: "#dfe4dd", muted: "#5b5f63", tint: "#eef1ec" };

function layout(title: string, bodyHtml: string, demo = false): string {
  const header = `<div style="background:${C.night};padding:18px 32px"><img src="${site()}/brand/heliostores-logo.png" width="180" height="51" alt="${esc(brand())}" style="display:block;border:0;color:#8ab4a8;font:bold 20px Arial,sans-serif"></div>`;
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,Helvetica,sans-serif;background:${C.page};color:${C.ink};padding:24px"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid ${C.border}">${header}<div style="padding:32px">${demo ? '<p style="background:#fff3cd;border:1px solid #e0c36a;padding:8px;font-family:sans-serif;font-size:12px">DÉMONSTRATION — préproduction, aucune valeur contractuelle.</p>' : ""}<h1 style="font-weight:bold;font-size:22px;color:${C.green}">${esc(title)}</h1>${bodyHtml}<p style="color:${C.muted};font-size:12px;margin-top:32px">${esc(brand())} — <a href="${site()}" style="color:${C.green}">${site()}</a></p></div></div></body></html>`;
}

type Line = { label: string; qty: number; totalGrossCents: number; included?: boolean };

function linesTable(lines: Line[]): string {
  return `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px">${lines.map((l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(l.label)}${l.qty > 1 ? ` × ${l.qty}` : ""}</td><td style="text-align:right;border-bottom:1px solid #eee">${l.included ? "inclus" : formatEur(l.totalGrossCents)}</td></tr>`).join("")}</table>`;
}

export function renderTemplate(template: string, p: Record<string, unknown>): { html: string; text: string } {
  const demo = Boolean(p.demo);
  switch (template) {
    case "password-reset":
      return { html: layout("Réinitialisation du mot de passe", `<p>Bonjour ${esc(p.name)},</p><p>Pour choisir un nouveau mot de passe, suivez ce lien (valable 1 heure) :</p><p><a href="${esc(p.url)}">${esc(p.url)}</a></p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`), text: `Réinitialisation : ${p.url}` };
    case "order-confirmation": {
      const lines = (p.lines as Line[]) ?? [];
      return { html: layout(`Commande ${esc(p.number)} confirmée`, `<p>Bonjour ${esc(p.firstName)},</p><p>Nous avons bien reçu votre paiement${demo ? " (simulé)" : ""}. Récapitulatif :</p>${linesTable(lines)}<p style="font-family:sans-serif"><strong>Total : ${formatEur(Number(p.totalCents))}</strong></p><p>Suivez votre commande : <a href="${site()}/compte/commandes/${esc(p.orderId)}">${site()}/compte/commandes/${esc(p.orderId)}</a></p>`, demo), text: `Commande ${p.number} confirmée. Total ${formatEur(Number(p.totalCents))}.` };
    }
    case "order-admin-notification":
      return { html: layout(`Nouvelle commande ${esc(p.number)}`, `<p>Commande payée${demo ? " (DEMO)" : ""} de ${esc(p.email)} — total ${formatEur(Number(p.totalCents))}.</p><p><a href="${site()}/admin/commandes/${esc(p.orderId)}">Ouvrir dans l'administration</a></p>`, demo), text: `Nouvelle commande ${p.number} — ${formatEur(Number(p.totalCents))}` };
    case "quote-received":
      return { html: layout(`Demande de devis ${esc(p.number)} reçue`, `<p>Bonjour ${esc(p.firstName)},</p><p>Nous avons bien reçu votre demande de devis. Un conseiller vous répond sous 48 h ouvrées.</p><p>Référence : <strong>${esc(p.number)}</strong></p>${p.lines ? linesTable(p.lines as Line[]) : ""}`, demo), text: `Devis ${p.number} reçu.` };
    case "quote-admin-notification":
      return { html: layout(`Nouvelle demande de devis ${esc(p.number)}`, `<p>De ${esc(p.email)} (${esc(p.kind)}). <a href="${site()}/admin/devis/${esc(p.quoteId)}">Ouvrir</a></p>${p.message ? `<p>Message : ${esc(p.message)}</p>` : ""}`, demo), text: `Nouveau devis ${p.number}` };
    case "contact-admin-notification":
      return { html: layout("Nouveau message de contact", `<p>De ${esc(p.name)} &lt;${esc(p.email)}&gt;${p.phone ? ` — ${esc(p.phone)}` : ""}</p><p>${esc(p.message)}</p>${p.preferredSlot ? `<p>Créneau souhaité : ${esc(p.preferredSlot)}</p>` : ""}`), text: `Contact de ${p.email}: ${p.message}` };
    case "contact-ack":
      return { html: layout("Nous avons bien reçu votre message", `<p>Bonjour ${esc(p.name)},</p><p>Merci pour votre message, nous revenons vers vous rapidement.</p>`), text: "Message reçu." };
    case "chat-admin-notification":
      return { html: layout(`Chat : nouveau message${p.offline ? " (hors ligne)" : ""}`, `<p>De ${esc(p.name)}${p.email ? ` &lt;${esc(p.email)}&gt;` : ""}${p.offline ? " — réponse attendue par e-mail" : ""}.</p><p style="white-space:pre-wrap;background:${C.tint};padding:12px">${esc(p.body)}</p><p><a href="${site()}/admin/conversations/${esc(p.conversationId)}">Répondre dans l'administration</a></p>`), text: `Nouveau message de chat : ${p.body}\n${site()}/admin/conversations/${p.conversationId}` };
    case "chat-advisor-reply":
      return { html: layout("Un conseiller vous a répondu", `<p>Bonjour${p.name ? ` ${esc(p.name)}` : ""},</p><p>Voici la réponse à votre message :</p><p style="white-space:pre-wrap;background:${C.tint};padding:12px">${esc(p.body)}</p><p>Pour poursuivre l'échange, rouvrez le chat sur <a href="${esc(p.url)}">${esc(p.url)}</a> ou répondez par le formulaire de contact.</p>`), text: `Réponse d'un conseiller : ${p.body}\n${p.url}` };
    case "account-export":
      return { html: layout("Export de vos données", `<p>Vos données personnelles sont jointes ci-dessous au format JSON.</p><pre style="font-size:11px;white-space:pre-wrap">${esc(p.json)}</pre>`), text: String(p.json) };
    default:
      return { html: layout(template, `<pre>${esc(JSON.stringify(p, null, 2))}</pre>`), text: JSON.stringify(p) };
  }
}
