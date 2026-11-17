import { HTML_LIMITED_BOT_UA_RE } from "next/dist/shared/lib/router/utils/html-bots";

/**
 * Robots des moteurs de réponse IA qui lisent le HTML sans exécuter le JavaScript et sont absents de la liste
 * par défaut de Next.js : sans eux, titre, description, canonique et robots d'une page dynamique arrivent en flux
 * après le `<head>` (métadonnées « streamées »), où ces robots ne les cherchent pas (backlog SEO B15).
 */
export const AI_ANSWER_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "MistralAI-User",
  "DuckAssistBot",
  "Amazonbot",
  "meta-externalagent",
  "CCBot",
] as const;

/**
 * `htmlLimitedBots` remplace la liste par défaut au lieu de la compléter : on garde donc la liste de Next.js
 * (importée pour suivre les mises à jour) et on y ajoute les robots d'IA. Next.js l'applique sans casse.
 */
export const HTML_LIMITED_BOTS = new RegExp(`${HTML_LIMITED_BOT_UA_RE.source}|${AI_ANSWER_BOTS.join("|")}`, "i");
