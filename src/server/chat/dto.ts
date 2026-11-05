import type { ChatConversationDto, ChatMessageDto } from "@/components/chat/types";
import type { ChatMessageMeta, ChatMessageRow } from "./service";

export function toMessageDto(m: ChatMessageRow): ChatMessageDto {
  const meta = (m.meta as ChatMessageMeta | null) ?? null;
  return {
    id: m.id,
    author: m.author,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    meta: meta ? { kind: meta.kind, handover: meta.handover, configurationId: meta.configurationId, shareToken: meta.shareToken, quoteId: meta.quoteId, orderId: meta.orderId, links: meta.links?.filter((l) => l.href.startsWith("/") && !l.href.startsWith("//")) } : null,
  };
}

export function toConversationDto(c: { id: string; status: ChatConversationDto["status"]; offline: boolean; email: string | null; configurationId: string | null; assignedUserId: string | null }): ChatConversationDto {
  return { id: c.id, status: c.status, offline: c.offline, email: c.email, configurationId: c.configurationId, assigned: Boolean(c.assignedUserId) };
}
