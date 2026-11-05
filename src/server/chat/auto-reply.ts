import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAssistant } from "./assistant";
import { postGuideReply } from "./guide";
import { hasHandover, listMessages, postAssistantMessage, postSystemMessage } from "./service";

/**
 * Réponse automatique à un message client, quand la conversation n'est ni prise en charge par un conseiller ni
 * transmise : assistant LLM s'il est configuré et disponible, sinon (ou en cas d'échec, de plafond atteint ou de
 * réponse écartée) aide immédiate déterministe. Toute erreur est avalée : le message reste enregistré pour l'équipe.
 */
export async function maybeAutoReply(conversationId: string): Promise<"assistant" | "guide" | null> {
  try {
    const c = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!c || c.status === "CLOSED" || c.assignedUserId) return null;
    if (await hasHandover(conversationId)) return null;
    const messages = await listMessages(conversationId, { advisor: true });
    const last = messages[messages.length - 1];
    if (!last || last.author !== "CUSTOMER") return null;
    // un conseiller a déjà répondu dans ce fil : la conversation est humaine, plus de réponse automatique
    if (messages.some((m) => m.author === "ADVISOR")) return null;
    const assistant = getAssistant();
    if (assistant) {
      const visible = messages.filter((m) => m.author === "CUSTOMER" || m.author === "ASSISTANT");
      const answer = await assistant.answer({ conversation: { id: c.id, subject: c.subject, name: c.name }, messages: visible.map((m) => ({ author: m.author, body: m.body })) });
      if (answer) {
        await postAssistantMessage(conversationId, answer.text, { model: answer.model, handover: answer.handover });
        if (answer.handover) await postSystemMessage(conversationId, "Demande transmise à l'équipe HELIOSTORES.", { kind: "handover", handover: true });
        return "assistant";
      }
    }
    await postGuideReply(conversationId, last.body);
    return "guide";
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e), conversationId }, "réponse automatique impossible");
    return null;
  }
}
