import "server-only";
import { prisma } from "@/lib/prisma";
import { ensureCatalogSnapshot } from "@/server/catalog/public-snapshot";
import { formatEur } from "@/domain/money";
import { logger } from "@/lib/logger";
import type { ChatMessageRow } from "./service";

/* ------------------------------------------------------------------ */
/* Interface                                                           */
/* ------------------------------------------------------------------ */

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

/** Assistant configuré, ou `null` : le chat humain/différé fonctionne sans lui. */
export function getAssistant(env: NodeJS.ProcessEnv = process.env): Assistant | null {
  if (env.AI_PROVIDER !== "anthropic") return null;
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  return new AnthropicAssistant(apiKey, env.AI_MODEL?.trim() || DEFAULT_MODEL, env.AI_BASE_URL?.trim() || "https://api.anthropic.com");
}

/* ------------------------------------------------------------------ */
/* Prompt système : catalogue public + documents publiés, rien d'autre  */
/* ------------------------------------------------------------------ */

const STATUS_FR: Record<string, string> = { demo: "DÉMO (non contractuel)", supplier_verified: "vérifié fournisseur", observed: "observé", unknown: "INCONNU" };

export async function buildSystemPrompt(): Promise<string> {
  const [catalog, documents] = await Promise.all([
    ensureCatalogSnapshot(),
    prisma.document.findMany({ where: { status: "PUBLISHED", audience: "PUBLIC" }, select: { title: true, summary: true, kind: true }, orderBy: { title: "asc" }, take: 100 }),
  ]);
  const families = catalog.families
    .filter((f) => f.status === "published" || f.status === "quote_only")
    .map((f) => `- ${f.name} (${f.slug}, ${f.kind}, ${f.status === "quote_only" ? "sur devis" : "publiée"}, données ${STATUS_FR[f.dataStatus] ?? f.dataStatus}) : ${f.shortDescription}`);
  const variants = catalog.variants.map((v) => `- ${v.sku} · ${v.label} · ${formatEur(v.priceCents)} TTC · ${v.purchasable ? "achetable" : "sur devis"} · données ${STATUS_FR[v.dataStatus] ?? v.dataStatus}`);
  const closure = catalog.closureCompat.map((r) => `- fermeture ${r.closureFamilySlug} / pergola ${r.pergolaFamilySlug} / segment ${r.segmentLengthMm} / finition ${r.pergolaFinishCode} / ${r.mounting} : ${r.status}${r.reason ? ` (${r.reason})` : ""} · données ${STATUS_FR[r.dataStatus] ?? r.dataStatus}`);
  const options = catalog.optionCompat.map((r) => `- option ${r.optionFamilySlug} / pergola ${r.pergolaFamilySlug} : ${r.status}${r.includedInBase ? " (incluse de base)" : ""}${r.reason ? ` (${r.reason})` : ""} · données ${STATUS_FR[r.dataStatus] ?? r.dataStatus}`);
  const docs = documents.map((d) => `- ${d.title} (${d.kind})${d.summary ? ` : ${d.summary}` : ""}`);
  return [
    "Tu es l'assistant automatique de la boutique en ligne de pergolas HELIOSTORES (préproduction). Tu réponds en français, brièvement et poliment.",
    "RÈGLES STRICTES :",
    "1. Réponds UNIQUEMENT à partir des données ci-dessous (catalogue public et documents publiés). N'invente jamais un prix, une dimension, un délai, une disponibilité ou une compatibilité.",
    "2. Si une information est absente, marquée INCONNU, ou si la question porte sur un prix sur mesure, un délai, une pose, une garantie, une réclamation ou une commande précise, réponds : « Je ne sais pas, je transmets à un conseiller. » et termine ta réponse par le marqueur " + HANDOVER_MARKER + ".",
    "3. Rappelle que les prix marqués DÉMO sont indicatifs et seront confirmés par un conseiller.",
    "4. Propose toujours la transmission à un conseiller humain pour un devis, une commande ou un cas particulier. Ne demande aucune donnée personnelle.",
    "5. Ne cite aucune source extérieure, ne parle pas d'autres marques, ne donne pas de conseils juridiques ou techniques hors catalogue.",
    "",
    `CATALOGUE (version ${catalog.version}) — familles :`,
    ...families,
    "",
    "Variantes (prix TTC catalogue) :",
    ...variants,
    "",
    "Règles de compatibilité des fermetures :",
    ...(closure.length ? closure : ["- aucune règle publiée : compatibilité INCONNUE"]),
    "",
    "Règles de compatibilité des options :",
    ...(options.length ? options : ["- aucune règle publiée : compatibilité INCONNUE"]),
    "",
    "Documents publiés :",
    ...(docs.length ? docs : ["- aucun document publié"]),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Fournisseur Anthropic (appel HTTP direct, sans SDK)                 */
/* ------------------------------------------------------------------ */

type ApiMessage = { role: "user" | "assistant"; content: string };

class AnthropicAssistant implements Assistant {
  readonly name = "anthropic";
  constructor(private readonly apiKey: string, readonly model: string, private readonly baseUrl: string) {}

  async answer(ctx: AssistantContext): Promise<AssistantAnswer | null> {
    const system = await buildSystemPrompt();
    // Fil chronologique : client → user, assistant/conseiller → assistant ; le premier tour doit être « user ».
    const history: ApiMessage[] = [];
    for (const m of ctx.messages.slice(-20)) {
      const role: ApiMessage["role"] = m.author === "CUSTOMER" ? "user" : "assistant";
      if (role === "assistant" && history.length === 0) continue;
      const prev = history[history.length - 1];
      if (prev && prev.role === role) prev.content += `\n\n${m.body}`;
      else history.push({ role, content: m.body });
    }
    if (!history.length || history[history.length - 1]!.role !== "user") return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": this.apiKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: this.model, max_tokens: 600, system, messages: history }),
        signal: controller.signal,
      });
      if (!res.ok) {
        logger.warn({ status: res.status }, "assistant chat : réponse HTTP non valide");
        return null;
      }
      const data = (await res.json()) as { stop_reason?: string; content?: Array<{ type: string; text?: string }> };
      if (data.stop_reason === "refusal") return null;
      const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n").trim();
      if (!text) return null;
      const handover = text.includes(HANDOVER_MARKER) || /je ne sais pas, je transmets/i.test(text);
      return { text: text.replaceAll(HANDOVER_MARKER, "").trim(), handover, model: this.model };
    } catch (e) {
      logger.warn({ err: e instanceof Error ? e.message : String(e) }, "assistant chat indisponible");
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
