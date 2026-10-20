"use server";
import { after } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { ensureGuestKey, getGuestKey } from "@/server/guest";
import { listConfigurations } from "@/server/configuration/service";
import { getAssistant } from "@/server/chat/assistant";
import { maybeAutoReply } from "@/server/chat/auto-reply";
import { toConversationDto, toMessageDto } from "@/server/chat/dto";
import { ChatError, MESSAGE_MAX_LENGTH, advisorsOnline, chatSettings, closeConversation, getActiveConversation, linkConfiguration, listMessages, postCustomerMessage, requestHandover, type Actor } from "@/server/chat/service";
import type { ChatConversationDto, ChatMessageDto, ChatState } from "@/components/chat/types";

export type ChatActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function currentActor(write: boolean): Promise<Actor & { email: string | null; name: string | null }> {
  const session = await getSession();
  const guestKey = write ? await ensureGuestKey() : await getGuestKey();
  return { userId: session?.user.id ?? null, guestKey, email: session?.user.email ?? null, name: session?.user.name ?? null };
}

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof ChatError) return { ok: false, error: e.message };
  return { ok: false, error: "Une erreur est survenue, réessayez." };
}

async function projectsFor(actor: Actor): Promise<ChatState["projects"]> {
  if (!actor.userId) return [];
  const list = await listConfigurations({ userId: actor.userId });
  return list.map((c) => ({ id: c.id, title: `${c.title ?? "Projet sans nom"} · v${c.version}` }));
}

/** État complet du widget à l'ouverture (conversation active, messages, présence, projets). */
export async function loadChatAction(): Promise<ChatActionResult<ChatState>> {
  try {
    const actor = await currentActor(false);
    const [settings, online] = await Promise.all([chatSettings(), advisorsOnline()]);
    const conversation = await getActiveConversation(actor);
    const messages = conversation ? await listMessages(conversation.id, actor) : [];
    return {
      ok: true,
      data: {
        enabled: settings.enabled,
        online,
        offlineMessage: settings.offlineMessage,
        assistant: getAssistant() !== null,
        signedIn: Boolean(actor.userId),
        email: actor.email,
        name: actor.name,
        conversation: conversation ? toConversationDto(conversation) : null,
        messages: messages.map(toMessageDto),
        projects: await projectsFor(actor),
      },
    };
  } catch (e) {
    return fail(e);
  }
}

const sendSchema = z.object({
  conversationId: z.string().max(64).nullish(),
  body: z.string().min(1, "Message vide").max(MESSAGE_MAX_LENGTH, `Message trop long (${MESSAGE_MAX_LENGTH} caractères maximum)`),
  email: z.string().trim().max(200).nullish(),
  name: z.string().trim().max(80).nullish(),
  consent: z.boolean().optional(),
  configurationId: z.string().max(64).nullish(),
  shareToken: z.string().max(128).nullish(),
});

export async function sendChatMessageAction(raw: unknown): Promise<ChatActionResult<{ conversation: ChatConversationDto; messages: ChatMessageDto[]; online: boolean }>> {
  const parsed = sendSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Saisie invalide" };
  const input = parsed.data;
  try {
    const settings = await chatSettings();
    if (!settings.enabled) return { ok: false, error: "Le chat est désactivé pour le moment." };
    const actor = await currentActor(true);
    const online = await advisorsOnline();
    const { conversation } = await postCustomerMessage({
      owner: actor,
      body: input.body,
      conversationId: input.conversationId ?? null,
      email: input.email || actor.email,
      name: input.name || actor.name,
      consentPrivacy: input.consent,
      offline: !online,
    });
    if ((input.configurationId || input.shareToken) && !conversation.configurationId) {
      try {
        await linkConfiguration(conversation.id, actor, { configurationId: input.configurationId, shareToken: input.shareToken });
      } catch {
        /* pièce jointe facultative : le message est déjà enregistré */
      }
    }
    after(() => maybeAutoReply(conversation.id));
    const messages = await listMessages(conversation.id, actor);
    const fresh = { ...conversation, configurationId: conversation.configurationId ?? (input.configurationId || null) };
    return { ok: true, data: { conversation: toConversationDto(fresh), messages: messages.map(toMessageDto), online } };
  } catch (e) {
    return fail(e);
  }
}

export async function attachProjectAction(raw: unknown): Promise<ChatActionResult<{ messages: ChatMessageDto[] }>> {
  const parsed = z.object({ conversationId: z.string().max(64), configurationId: z.string().max(64).nullish(), shareToken: z.string().max(128).nullish() }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  try {
    const actor = await currentActor(false);
    await linkConfiguration(parsed.data.conversationId, actor, parsed.data);
    const messages = await listMessages(parsed.data.conversationId, actor);
    return { ok: true, data: { messages: messages.map(toMessageDto) } };
  } catch (e) {
    return fail(e);
  }
}

/** « Parler à un conseiller » : message SYSTEM handover, conversation OPEN non assignée. */
export async function handoverAction(raw: unknown): Promise<ChatActionResult<{ messages: ChatMessageDto[] }>> {
  const parsed = z.object({ conversationId: z.string().max(64) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  try {
    const actor = await currentActor(false);
    await requestHandover(parsed.data.conversationId, actor);
    const messages = await listMessages(parsed.data.conversationId, actor);
    return { ok: true, data: { messages: messages.map(toMessageDto) } };
  } catch (e) {
    return fail(e);
  }
}

export async function closeChatAction(raw: unknown): Promise<ChatActionResult<null>> {
  const parsed = z.object({ conversationId: z.string().max(64) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Saisie invalide" };
  try {
    const actor = await currentActor(false);
    await closeConversation(parsed.data.conversationId, actor);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
