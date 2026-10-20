import "server-only";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getAssistant } from "./assistant";
import { hasHandover, listMessages, postAssistantMessage, postSystemMessage } from "./service";

/**
 * Tente une réponse automatique après un message client. Ne fait rien si aucun assistant n'est
 * configuré, si la conversation est déjà prise en charge par un conseiller ou si une transmission a
 * été demandée. Toute erreur est avalée : le fil reste humain/différé.
 */
export async function maybeAutoReply(conversationId: string): Promise<boolean> {
  const assistant = getAssistant();
  if (!assistant) return false;
  try {
    const c = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!c || c.status === "CLOSED" || c.assignedUserId) return false;
    if (await hasHandover(conversationId)) return false;
    const messages = await listMessages(conversationId, { advisor: true });
    const visible = messages.filter((m) => m.author === "CUSTOMER" || m.author === "ASSISTANT");
    const last = messages[messages.length - 1];
    if (!last || last.author !== "CUSTOMER") return false;
    const answer = await assistant.answer({ conversation: { id: c.id, subject: c.subject, name: c.name }, messages: visible.map((m) => ({ author: m.author, body: m.body })) });
    if (!answer) return false;
    await postAssistantMessage(conversationId, answer.text, { model: answer.model, handover: answer.handover });
    if (answer.handover) await postSystemMessage(conversationId, "L'assistant transmet la demande à un conseiller.", { kind: "handover", handover: true });
    return true;
  } catch (e) {
    logger.warn({ err: e instanceof Error ? e.message : String(e), conversationId }, "réponse automatique impossible");
    return false;
  }
}
