import { formatEur } from "@/domain/money";

const brand = () => process.env.NEXT_PUBLIC_BRAND_NAME ?? "ELIOS SOLAR";
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400";

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function layout(title: string, bodyHtml: string, demo = false): string {
  return `<!doctype html><html lang="fr"><body style="font-family:Georgia,serif;background:#faf8f4;color:#1f2123;padding:24px"><div style="max-width:600px;margin:auto;background:#fff;border:1px solid #e6e1d8;padding:32px">${demo ? '<p style="background:#fff3cd;border:1px solid #e0c36a;padding:8px;font-family:sans-serif;font-size:12px">DÉMONSTRATION — préproduction, aucune valeur contractuelle.</p>' : ""}<h1 style="font-weight:normal;font-size:22px">${esc(title)}</h1>${bodyHtml}<p style="color:#6b6b6b;font-size:12px;margin-top:32px">${esc(brand())} — <a href="${site()}">${site()}</a></p></div></body></html>`;
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
    case "account-export":
      return { html: layout("Export de vos données", `<p>Vos données personnelles sont jointes ci-dessous au format JSON.</p><pre style="font-size:11px;white-space:pre-wrap">${esc(p.json)}</pre>`), text: String(p.json) };
    default:
      return { html: layout(template, `<pre>${esc(JSON.stringify(p, null, 2))}</pre>`), text: JSON.stringify(p) };
  }
}
