import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { PUBLIC_FORBIDDEN_NAMES, PUBLIC_RETIRED_NAMES } from "@/domain/public-sanitize";
import { guideKnowledge } from "./guide";
import type { ChatMessageRow } from "./service";

/**
 * Assistant automatique du chat (mode B) — DÉSACTIVÉ tant qu'aucun fournisseur n'est configuré. Sans lui, l'aide
 * immédiate déterministe (`./guide.ts`) répond et la demande est enregistrée pour l'équipe.
 *
 * Configuration (variables d'environnement du serveur, jamais dans le navigateur, le dépôt ni les journaux) :
 * - `AI_PROVIDER` : "" (désactivé, par défaut) | "anthropic" | "openai_compatible" (API « chat completions », ex.
 *   DeepSeek : `AI_BASE_URL=https://api.deepseek.com`) ;
 * - clé : `ANTHROPIC_API_KEY` (anthropic) ou `AI_API_KEY` (openai_compatible) ;
 * - `AI_MODEL` (obligatoire pour openai_compatible), `AI_BASE_URL` (URL du service, https obligatoire hors local) ;
 * - plafonds : `AI_MAX_TOKENS` (600), `AI_TIMEOUT_MS` (20 000), `AI_DAILY_LIMIT` (200 réponses par 24 h, tous
 *   visiteurs confondus ; au-delà, repli sur l'aide immédiate).
 * Documentation, coûts et transmission des données : docs/chatbot.md.
 */

export interface AssistantContext {
  conversation: { id: string; subject: string; name: string | null };
  /** fil complet (notes internes exclues), ordre chronologique */
  messages: Pick<ChatMessageRow, "author" | "body">[];
}

export interface AssistantAnswer {
  text: string;
  /** l'assistant demande la transmission à un conseiller */
  handover: boolean;
  model?: string;
}

export interface Assistant {
  readonly name: string;
  readonly model: string;
  answer(ctx: AssistantContext): Promise<AssistantAnswer | null>;
}

export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const HANDOVER_MARKER = "[TRANSMETTRE]";

interface Limits { maxTokens: number; timeoutMs: number; dailyLimit: number }

const int = (v: string | undefined, def: number, min: number, max: number) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function assistantLimits(env: NodeJS.ProcessEnv = process.env): Limits {
  return { maxTokens: int(env.AI_MAX_TOKENS, 600, 100, 2000), timeoutMs: int(env.AI_TIMEOUT_MS, 20_000, 2_000, 60_000), dailyLimit: int(env.AI_DAILY_LIMIT, 200, 0, 100_000) };
}

/** URL de service acceptée : https, ou http seulement vers la machine locale (tests). */
function serviceUrl(raw: string | undefined, fallback: string | null): string | null {
  const v = raw?.trim() || fallback;
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol === "https:" || (u.protocol === "http:" && ["127.0.0.1", "localhost"].includes(u.hostname))) return v.replace(/\/+$/, "");
  } catch { /* URL invalide */ }
  return null;
}

/** Assistant configuré, ou `null` : l'aide immédiate et le chat différé fonctionnent sans lui. */
export function getAssistant(env: NodeJS.ProcessEnv = process.env): Assistant | null {
  const limits = assistantLimits(env);
  if (env.AI_PROVIDER === "anthropic") {
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    const base = serviceUrl(env.AI_BASE_URL, "https://api.anthropic.com");
    return apiKey && base ? new AnthropicAssistant(apiKey, env.AI_MODEL?.trim() || DEFAULT_MODEL, base, limits) : null;
  }
  if (env.AI_PROVIDER === "openai_compatible") {
    const apiKey = env.AI_API_KEY?.trim();
    const model = env.AI_MODEL?.trim();
    const base = serviceUrl(env.AI_BASE_URL, null);
    return apiKey && model && base ? new OpenAiCompatibleAssistant(apiKey, model, base, limits) : null;
  }
  return null;
}

/** Réponses automatiques LLM des dernières 24 h (plafond de consommation, tous visiteurs confondus). */
export async function dailyQuotaReached(limit: number, now = new Date()): Promise<boolean> {
  if (limit <= 0) return true;
  const n = await prisma.chatMessage.count({ where: { author: "ASSISTANT", createdAt: { gte: new Date(now.getTime() - 86_400_000) }, NOT: { meta: { path: ["kind"], equals: "guide" } } } });
  return n >= limit;
}

/* ------------------------------------------------------------------ */
/* Données transmises : aucune coordonnée, aucun montant, aucune réf.   */
/* ------------------------------------------------------------------ */

/** Masque e-mails, numéros de téléphone et adresses postales probables avant tout envoi au fournisseur. */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi, "[e-mail]")
    .replace(/(?:\+|00)?\d(?:[\s.-]?\d){8,13}/g, "[téléphone]")
    .replace(/\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.|boulevard|bd|chemin|allée|impasse|place|route|quai)\b[^\n,]*/gi, "[adresse]");
}

/**
 * Contrôle d'une réponse avant publication : refusée si elle cite une référence fournisseur, un ancien nom ou un
 * montant (le chat ne communique aucun prix ; le configurateur calcule les prix publiés).
 */
export function acceptableAnswer(text: string): boolean {
  if (PUBLIC_FORBIDDEN_NAMES.test(text) || PUBLIC_RETIRED_NAMES.test(text)) return false;
  if (/\d[\d\s.,]*\s?(€|eur\b|euros?\b|dh\b|mad\b)/i.test(text) || /€\s?\d/.test(text)) return false;
  return true;
}

export async function buildSystemPrompt(): Promise<string> {
  const [k, documents] = await Promise.all([
    guideKnowledge(),
    prisma.document.findMany({ where: { status: "PUBLISHED", audience: "PUBLIC" }, select: { title: true, summary: true, kind: true }, orderBy: { title: "asc" }, take: 100 }),
  ]);
  const families = k.families.map((f) => `- ${f.name} (${f.categoryLabel}) : ${f.shortDescription} Prix : ${f.priced ? "affiché par le configurateur pour les configurations couvertes" : "sur devis"}.${f.toConfirm ? " Caractéristiques en cours de confirmation technique." : ""} Fiche : ${f.href}`);
  const docs = documents.filter((d) => !PUBLIC_FORBIDDEN_NAMES.test(`${d.title} ${d.summary ?? ""}`)).map((d) => `- ${d.title} (${d.kind})${d.summary ? ` : ${d.summary}` : ""}`);
  return [
    "Tu es l'aide automatique du site HELIOSTORES (pergolas, screens, stores bannes et moustiquaires). Tu réponds en français, brièvement et poliment. Tu n'es pas un conseiller humain et ne le prétends jamais.",
    "RÈGLES STRICTES :",
    "1. Réponds UNIQUEMENT à partir des informations ci-dessous. N'invente jamais une dimension, un délai, un stock, une certification, un équipement inclus ou une compatibilité. Une compatibilité non indiquée est « à confirmer sur devis ».",
    "2. Ne donne AUCUN montant et ne calcule aucun prix : le prix d'une configuration est calculé par le configurateur du site, sinon établi sur devis.",
    "3. Utilise uniquement les noms de produits ci-dessous. Ne cite aucun fabricant, fournisseur, référence technique ou autre marque.",
    `4. Pour une commande, un paiement, une garantie, une réclamation, un délai précis ou une information absente, réponds que l'équipe HELIOSTORES traitera la demande et termine par le marqueur ${HANDOVER_MARKER}.`,
    "5. Ne demande aucune donnée personnelle et ne modifie rien : aucun devis, aucune commande, aucun paiement ne peut être créé ou changé dans ce chat.",
    "",
    "PRODUITS :",
    ...families,
    "",
    `Délai de livraison publié : ${k.deliveryLeadTime} La livraison et la pose ne sont pas comprises dans un prix affiché en ligne.`,
    "",
    "Documents publiés :",
    ...(docs.length ? docs : ["- aucun document publié"]),
  ].join("\n");
}

type Turn = { role: "user" | "assistant"; content: string };

/** Fil chronologique pour le fournisseur : 20 derniers messages, coordonnées masquées, premier tour « user ». */
export function toTurns(messages: AssistantContext["messages"]): Turn[] {
  const history: Turn[] = [];
  for (const m of messages.slice(-20)) {
    const role: Turn["role"] = m.author === "CUSTOMER" ? "user" : "assistant";
    if (role === "assistant" && history.length === 0) continue;
    const content = redactPersonalData(m.body);
    const prev = history[history.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${content}`;
    else history.push({ role, content });
  }
  return history.length && history[history.length - 1]!.role === "user" ? history : [];
}

abstract class HttpAssistant implements Assistant {
  abstract readonly name: string;
  constructor(protected readonly apiKey: string, readonly model: string, protected readonly baseUrl: string, protected readonly limits: Limits) {}
  protected abstract call(system: string, turns: Turn[], signal: AbortSignal): Promise<{ ok: boolean; status: number; text: string | null; refused?: boolean }>;

  async answer(ctx: AssistantContext): Promise<AssistantAnswer | null> {
    const turns = toTurns(ctx.messages);
    if (!turns.length) return null;
    if (await dailyQuotaReached(this.limits.dailyLimit)) { logger.warn({ provider: this.name }, "assistant chat : plafond quotidien atteint, repli sur l'aide immédiate"); return null; }
    const system = await buildSystemPrompt();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.limits.timeoutMs);
    try {
      const r = await this.call(system, turns, controller.signal);
      if (!r.ok) { logger.warn({ provider: this.name, status: r.status }, "assistant chat : réponse HTTP non valide"); return null; }
      const text = r.text?.trim();
      if (r.refused || !text) return null;
      const clean = text.replaceAll(HANDOVER_MARKER, "").trim();
      if (!acceptableAnswer(clean)) { logger.warn({ provider: this.name }, "assistant chat : réponse écartée (montant, référence ou ancien nom)"); return null; }
      return { text: clean, handover: text.includes(HANDOVER_MARKER), model: this.model };
    } catch (e) {
      logger.warn({ provider: this.name, err: e instanceof Error ? e.name : "erreur" }, "assistant chat indisponible");
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

class AnthropicAssistant extends HttpAssistant {
  readonly name = "anthropic";
  protected async call(system: string, turns: Turn[], signal: AbortSignal) {
    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: "POST", signal,
      headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: this.model, max_tokens: this.limits.maxTokens, system, messages: turns }),
    });
    if (!res.ok) return { ok: false, status: res.status, text: null };
    const data = (await res.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
    return { ok: true, status: res.status, refused: data.stop_reason === "refusal", text: (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n") };
  }
}

/** API « chat completions » compatible OpenAI (ex. DeepSeek) : URL et modèle fournis par la configuration. */
class OpenAiCompatibleAssistant extends HttpAssistant {
  readonly name = "openai_compatible";
  protected async call(system: string, turns: Turn[], signal: AbortSignal) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, max_tokens: this.limits.maxTokens, stream: false, messages: [{ role: "system", content: system }, ...turns] }),
    });
    if (!res.ok) return { ok: false, status: res.status, text: null };
    const data = (await res.json()) as { choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }> };
    const c = data.choices?.[0];
    return { ok: true, status: res.status, refused: c?.finish_reason === "content_filter", text: c?.message?.content ?? null };
  }
}
