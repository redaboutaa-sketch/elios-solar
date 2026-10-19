import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { toMessageDto } from "@/server/chat/dto";
import { ChatError, advisorsOnline, getConversationFor, listMessages, markCustomerRead } from "@/server/chat/service";
import type { ChatPollResponse } from "@/components/chat/types";

/**
 * Rafraîchissement du fil (polling) : GET /api/chat/messages?conversationId=&after=<ISO>&read=1
 * Le propriétaire (compte ou clé invité) est vérifié ; `read=1` signale la lecture côté client.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.slice(0, 64);
  if (!conversationId) return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
  const afterRaw = url.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : null;
  if (after && Number.isNaN(after.getTime())) return NextResponse.json({ error: "after invalide" }, { status: 400 });
  const [session, guestKey] = await Promise.all([getSession(), getGuestKey()]);
  const actor = { userId: session?.user.id ?? null, guestKey };
  try {
    const conversation = await getConversationFor(conversationId, actor);
    if (!conversation) return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    const [messages, online] = await Promise.all([listMessages(conversationId, actor, { after }), advisorsOnline()]);
    if (url.searchParams.get("read") === "1") await markCustomerRead(conversationId, actor);
    const body: ChatPollResponse = { messages: messages.map(toMessageDto), status: conversation.status, online, assigned: Boolean(conversation.assignedUserId) };
    return NextResponse.json(body, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof ChatError) return NextResponse.json({ error: e.message }, { status: e.code === "NOT_FOUND" ? 404 : 400 });
    throw e;
  }
}
