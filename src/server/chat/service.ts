import { prisma } from "@/lib/prisma";
import type { ConversationStatus, MessageAuthor, Prisma } from "@/generated/prisma/client";
import { enqueueEmail } from "@/server/mail/outbox";

/* ------------------------------------------------------------------ */
/* Types et constantes                                                 */
/* ------------------------------------------------------------------ */

export type Owner = { userId?: string | null; guestKey?: string | null };
/** Acteur d'une lecture : propriétaire (compte ou invité) ou conseiller (ADMIN/MANAGER). */
export type Actor = Owner & { advisor?: boolean };

export const MESSAGE_MAX_LENGTH = 2000;
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 300;
/** Un conseiller est « en ligne » si vu dans l'administration depuis moins de 5 minutes. */
export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;
/** Le client est considéré actif si son widget a signalé une lecture depuis moins de 10 minutes. */
export const CUSTOMER_ACTIVE_WINDOW_MS = 10 * 60 * 1000;
/** Tranche de regroupement des notifications e-mail (dedupeKey). */
export const NOTIFY_SLICE_MS = 10 * 60 * 1000;

export class ChatError extends Error {
  constructor(message: string, public readonly code: "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "INVALID" | "CLOSED" = "INVALID") {
    super(message);
    this.name = "ChatError";
  }
}

export type ChatMessageMeta = {
  /** note interne : visible uniquement par les conseillers */
  internal?: boolean;
  /** événement système : handover (transmission à un conseiller), link (pièce jointe), status… */
  kind?: "handover" | "link" | "status" | "assistant_error";
  /** l'assistant a demandé une transmission à un conseiller */
  handover?: boolean;
  configurationId?: string;
  shareToken?: string;
  quoteId?: string;
  orderId?: string;
  model?: string;
};

export const messageSelect = { id: true, conversationId: true, author: true, authorUserId: true, body: true, meta: true, createdAt: true } satisfies Prisma.ChatMessageSelect;
export type ChatMessageRow = Prisma.ChatMessageGetPayload<{ select: typeof messageSelect }>;

/* ------------------------------------------------------------------ */
/* Limitation de fréquence par propriétaire (mémoire, instance unique) */
/* ------------------------------------------------------------------ */

const buckets = new Map<string, { count: number; resetAt: number }>();

function ownerKey(owner: Owner): string {
  if (owner.userId) return `u:${owner.userId}`;
  if (owner.guestKey) return `g:${owner.guestKey}`;
  throw new ChatError("Propriétaire inconnu", "FORBIDDEN");
}

/** Retourne false si la limite (10 messages / 5 min par propriétaire) est dépassée. */
export function chatRateLimit(owner: Owner, max = RATE_LIMIT_MAX, windowSeconds = RATE_LIMIT_WINDOW_SECONDS): boolean {
  const key = ownerKey(owner);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  b.count += 1;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  return b.count <= max;
}

/** Pour les tests. */
export function resetChatRateLimits() {
  buckets.clear();
}

/* ------------------------------------------------------------------ */
/* Présence des conseillers                                            */
/* ------------------------------------------------------------------ */

/**
 * Met à jour `lastSeenAt` au plus une fois par minute (une seule requête UPDATE conditionnelle,
 * pas d'écriture à chaque rendu). À appeler depuis le layout d'administration.
 */
export async function touchPresence(userId: string, now = new Date()): Promise<void> {
  const threshold = new Date(now.getTime() - 60 * 1000);
  await prisma.user.updateMany({ where: { id: userId, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: threshold } }] }, data: { lastSeenAt: now } });
}

/** Vrai uniquement si le chat est activé ET qu'un ADMIN/MANAGER a été vu depuis moins de 5 minutes. */
export async function advisorsOnline(now = new Date()): Promise<boolean> {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { chatEnabled: true } });
  if (settings && !settings.chatEnabled) return false;
  const n = await prisma.user.count({ where: { role: { in: ["ADMIN", "MANAGER"] }, deletedAt: null, lastSeenAt: { gte: new Date(now.getTime() - PRESENCE_WINDOW_MS) } } });
  return n > 0;
}

export async function chatSettings() {
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 }, select: { chatEnabled: true, chatOfflineMessage: true } });
  return { enabled: s?.chatEnabled ?? true, offlineMessage: s?.chatOfflineMessage?.trim() || "Nos conseillers ne sont pas connectés : laissez un message, nous vous répondrons par e-mail." };
}

/* ------------------------------------------------------------------ */
/* Contrôle d'accès                                                    */
/* ------------------------------------------------------------------ */

/** Même règle que `isOwner` de configuration/service (dupliquée pour rester utilisable hors Next, ex. scripts). */
function isConfigurationOwner(c: { ownerUserId: string | null; guestKey: string | null }, owner: Owner): boolean {
  if (owner.userId && c.ownerUserId === owner.userId) return true;
  return !c.ownerUserId && !!owner.guestKey && c.guestKey === owner.guestKey;
}

export function canAccess(c: { userId: string | null; guestKey: string | null }, actor: Actor): boolean {
  if (actor.advisor) return true;
  if (actor.userId) return c.userId === actor.userId;
  if (actor.guestKey) return !c.userId && c.guestKey === actor.guestKey;
  return false;
}

/** Conversation accessible par l'acteur, sinon `null` (jamais d'indice sur l'existence). */
export async function getConversationFor(id: string, actor: Actor) {
  const c = await prisma.conversation.findUnique({ where: { id } });
  if (!c || !canAccess(c, actor)) return null;
  return c;
}

/** Conversation active (non fermée) la plus récente du propriétaire. */
export async function getActiveConversation(owner: Owner) {
  if (!owner.userId && !owner.guestKey) return null;
  return prisma.conversation.findFirst({
    where: { ...(owner.userId ? { userId: owner.userId } : { guestKey: owner.guestKey!, userId: null }), status: { not: "CLOSED" } },
    orderBy: { lastMessageAt: "desc" },
  });
}

export async function listConversationsFor(owner: Owner) {
  if (!owner.userId && !owner.guestKey) return [];
  return prisma.conversation.findMany({
    where: owner.userId ? { userId: owner.userId } : { guestKey: owner.guestKey!, userId: null },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    include: { messages: { orderBy: { createdAt: "asc" }, select: messageSelect } },
  });
}

/** Rattache les conversations invité au compte après connexion. */
export async function claimGuestConversations(userId: string, guestKey: string) {
  await prisma.conversation.updateMany({ where: { guestKey, userId: null }, data: { userId } });
}

function isInternal(m: { author: MessageAuthor; meta: unknown }): boolean {
  return m.author !== "CUSTOMER" && Boolean((m.meta as ChatMessageMeta | null)?.internal);
}

/** Messages d'une conversation ; les notes internes sont masquées aux clients. */
export async function listMessages(conversationId: string, actor: Actor, opts: { after?: Date | null } = {}): Promise<ChatMessageRow[]> {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, ...(opts.after ? { createdAt: { gt: opts.after } } : {}) },
    orderBy: { createdAt: "asc" },
    select: messageSelect,
  });
  return actor.advisor ? rows : rows.filter((m) => !isInternal(m));
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

/** Le client signale qu'il lit (au plus une écriture par minute : sert aussi de signal d'activité). */
export async function markCustomerRead(conversationId: string, actor: Actor, now = new Date()) {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const threshold = new Date(now.getTime() - 60 * 1000);
  await prisma.conversation.updateMany({ where: { id: conversationId, OR: [{ lastCustomerReadAt: null }, { lastCustomerReadAt: { lt: threshold } }] }, data: { lastCustomerReadAt: now } });
}

export async function markAdvisorRead(conversationId: string, now = new Date()) {
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastAdvisorReadAt: now } });
}

/** Conversations ouvertes dont le dernier message n'a pas été lu par un conseiller. */
export function unreadForAdvisorsWhere(): Prisma.ConversationWhereInput {
  return { status: { not: "CLOSED" }, OR: [{ lastAdvisorReadAt: null }, { lastAdvisorReadAt: { lt: prisma.conversation.fields.lastMessageAt } }] };
}

export async function countUnreadForAdvisors(): Promise<number> {
  return prisma.conversation.count({ where: unreadForAdvisorsWhere() });
}

/** Nombre de messages conseiller/assistant non lus par le client (hors notes internes). */
export async function countUnreadForCustomer(conversationId: string, actor: Actor): Promise<number> {
  const c = await getConversationFor(conversationId, actor);
  if (!c) return 0;
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId, author: { in: ["ADVISOR", "ASSISTANT", "SYSTEM"] }, ...(c.lastCustomerReadAt ? { createdAt: { gt: c.lastCustomerReadAt } } : {}) },
    select: { author: true, meta: true },
  });
  return rows.filter((m) => !isInternal(m)).length;
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

function normalizeBody(body: string): string {
  const b = body.replace(/\r\n/g, "\n").trim();
  if (!b) throw new ChatError("Message vide");
  if (b.length > MESSAGE_MAX_LENGTH) throw new ChatError(`Message trop long (${MESSAGE_MAX_LENGTH} caractères maximum)`);
  return b;
}

function slice(now: Date): number {
  return Math.floor(now.getTime() / NOTIFY_SLICE_MS);
}

export interface PostCustomerMessageInput {
  owner: Owner;
  body: string;
  /** conversation existante (sinon la conversation active du propriétaire, sinon création) */
  conversationId?: string | null;
  email?: string | null;
  name?: string | null;
  consentPrivacy?: boolean;
  /** aucun conseiller en ligne : message différé (e-mail obligatoire) */
  offline?: boolean;
  subject?: string | null;
}

/**
 * Message client : crée la conversation si nécessaire, applique la limite de fréquence,
 * exige e-mail + consentement en mode hors ligne, notifie l'administration (regroupé par 10 min).
 */
export async function postCustomerMessage(input: PostCustomerMessageInput, now = new Date()) {
  const { owner } = input;
  if (!owner.userId && !owner.guestKey) throw new ChatError("Propriétaire inconnu", "FORBIDDEN");
  const body = normalizeBody(input.body);
  const email = input.email?.trim().toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ChatError("Adresse e-mail invalide");

  let conversation = input.conversationId ? await getConversationFor(input.conversationId, owner) : await getActiveConversation(owner);
  if (input.conversationId && !conversation) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  if (conversation?.status === "CLOSED") conversation = null;

  if (!conversation) {
    if (!input.consentPrivacy) throw new ChatError("Le consentement à la politique de confidentialité est requis.");
    if (input.offline && !email) throw new ChatError("Indiquez votre adresse e-mail pour recevoir la réponse.");
    if (!chatRateLimit(owner)) throw new ChatError("Trop de messages, réessayez dans quelques minutes.", "RATE_LIMITED");
    conversation = await prisma.conversation.create({
      data: {
        userId: owner.userId ?? null,
        guestKey: owner.userId ? null : owner.guestKey,
        email,
        name: input.name?.trim().slice(0, 80) || null,
        subject: (input.subject?.trim() || body).slice(0, 120),
        offline: Boolean(input.offline),
        consentPrivacy: true,
        lastMessageAt: now,
        lastCustomerReadAt: now,
      },
    });
  } else {
    if (!chatRateLimit(owner)) throw new ChatError("Trop de messages, réessayez dans quelques minutes.", "RATE_LIMITED");
    const patch: Prisma.ConversationUpdateInput = { lastMessageAt: now, lastCustomerReadAt: now };
    if (email && !conversation.email) patch.email = email;
    if (input.name && !conversation.name) patch.name = input.name.trim().slice(0, 80);
    if (input.offline && !conversation.offline) patch.offline = true;
    if (conversation.status === "WAITING_CUSTOMER") patch.status = "OPEN";
    conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: patch });
  }

  const message = await prisma.chatMessage.create({ data: { conversationId: conversation.id, author: "CUSTOMER", authorUserId: owner.userId ?? null, body }, select: messageSelect });

  const admin = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (admin) {
    await enqueueEmail({
      to: admin,
      subject: `Chat : nouveau message${conversation.offline ? " (hors ligne)" : ""}`,
      template: "chat-admin-notification",
      payload: { conversationId: conversation.id, name: conversation.name ?? "Visiteur", email: conversation.email, body: body.slice(0, 1000), offline: conversation.offline },
      dedupeKey: `chat-admin:${conversation.id}:${slice(now)}`,
    });
  }
  return { conversation, message };
}

/**
 * Réponse d'un conseiller (ou note interne). Le client est averti par e-mail si la conversation est
 * hors ligne, ou si un e-mail est connu et que le client n'est plus actif depuis 10 minutes.
 */
export async function postAdvisorMessage(conversationId: string, advisorUserId: string, rawBody: string, opts: { internal?: boolean } = {}, now = new Date()) {
  const body = normalizeBody(rawBody);
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const meta: ChatMessageMeta | undefined = opts.internal ? { internal: true } : undefined;
  const message = await prisma.chatMessage.create({ data: { conversationId, author: "ADVISOR", authorUserId: advisorUserId, body, meta: meta as never }, select: messageSelect });
  if (opts.internal) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastAdvisorReadAt: now } });
    return { conversation, message, notified: false };
  }
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: now, lastAdvisorReadAt: now, status: conversation.status === "CLOSED" ? "OPEN" : "WAITING_CUSTOMER", assignedUserId: conversation.assignedUserId ?? advisorUserId },
  });
  const customerActive = conversation.lastCustomerReadAt ? now.getTime() - conversation.lastCustomerReadAt.getTime() < CUSTOMER_ACTIVE_WINDOW_MS : false;
  const shouldNotify = Boolean(conversation.email) && (conversation.offline || !customerActive);
  if (shouldNotify) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400";
    await enqueueEmail({
      to: conversation.email!,
      subject: "Un conseiller vous a répondu",
      template: "chat-advisor-reply",
      payload: { name: conversation.name ?? "", body, url: conversation.userId ? `${site}/compte/echanges` : site },
      dedupeKey: `chat-reply:${conversationId}:${slice(now)}`,
    });
  }
  return { conversation: updated, message, notified: shouldNotify };
}

/** Message système (lien, transmission…) : n'alerte personne par e-mail. */
export async function postSystemMessage(conversationId: string, body: string, meta: ChatMessageMeta, now = new Date()) {
  const message = await prisma.chatMessage.create({ data: { conversationId, author: "SYSTEM", body: body.slice(0, MESSAGE_MAX_LENGTH), meta: meta as never }, select: messageSelect });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
  return message;
}

/** Réponse de l'assistant automatique (enregistrée avec author = ASSISTANT). */
export async function postAssistantMessage(conversationId: string, body: string, meta: ChatMessageMeta = {}, now = new Date()) {
  const message = await prisma.chatMessage.create({ data: { conversationId, author: "ASSISTANT", body: body.slice(0, MESSAGE_MAX_LENGTH), meta: meta as never }, select: messageSelect });
  await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
  return message;
}

/** Le client (ou l'assistant) demande un conseiller : message SYSTEM `handover`, conversation OPEN non assignée. */
export async function requestHandover(conversationId: string, actor: Actor, reason = "Le client souhaite parler à un conseiller.") {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const message = await postSystemMessage(conversationId, reason, { kind: "handover", handover: true });
  await prisma.conversation.update({ where: { id: conversationId }, data: { status: "OPEN", assignedUserId: null, lastAdvisorReadAt: null } });
  return message;
}

export async function hasHandover(conversationId: string): Promise<boolean> {
  const n = await prisma.chatMessage.count({ where: { conversationId, author: "SYSTEM", meta: { path: ["kind"], equals: "handover" } } });
  return n > 0;
}

/* ------------------------------------------------------------------ */
/* Liens vers configuration / devis / commande                         */
/* ------------------------------------------------------------------ */

/**
 * Joint une configuration : par identifiant (le propriétaire doit la posséder) ou par jeton de
 * partage public (page /projets/[token], lien non révoqué).
 */
export async function linkConfiguration(conversationId: string, actor: Actor, ref: { configurationId?: string | null; shareToken?: string | null }) {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const config = ref.configurationId
    ? await prisma.configuration.findUnique({ where: { id: ref.configurationId } })
    : ref.shareToken
      ? await prisma.configuration.findUnique({ where: { shareToken: ref.shareToken } })
      : null;
  if (!config) throw new ChatError("Configuration introuvable", "NOT_FOUND");
  if (ref.configurationId && !actor.advisor && !isConfigurationOwner(config, actor)) throw new ChatError("Configuration introuvable", "NOT_FOUND");
  if (!ref.configurationId && config.shareRevoked) throw new ChatError("Lien de partage révoqué", "NOT_FOUND");
  await prisma.conversation.update({ where: { id: conversationId }, data: { configurationId: config.id } });
  const label = config.title ?? "Projet de pergola";
  const message = await postSystemMessage(conversationId, `Configuration jointe : ${label}`, { kind: "link", configurationId: config.id, shareToken: config.shareRevoked ? undefined : config.shareToken });
  return { configuration: config, message };
}

export async function linkQuote(conversationId: string, actor: Actor, quoteId: string) {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const q = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, number: true, userId: true } });
  if (!q || (!actor.advisor && (!actor.userId || q.userId !== actor.userId))) throw new ChatError("Devis introuvable", "NOT_FOUND");
  await prisma.conversation.update({ where: { id: conversationId }, data: { quoteId: q.id } });
  return postSystemMessage(conversationId, `Devis joint : ${q.number}`, { kind: "link", quoteId: q.id });
}

export async function linkOrder(conversationId: string, actor: Actor, orderId: string) {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, userId: true, guestKey: true } });
  const owns = o && (actor.advisor || (actor.userId ? o.userId === actor.userId : !o.userId && !!actor.guestKey && o.guestKey === actor.guestKey));
  if (!o || !owns) throw new ChatError("Commande introuvable", "NOT_FOUND");
  await prisma.conversation.update({ where: { id: conversationId }, data: { orderId: o.id } });
  return postSystemMessage(conversationId, `Commande jointe : ${o.number}`, { kind: "link", orderId: o.id });
}

/* ------------------------------------------------------------------ */
/* Statut et assignation (côté conseiller)                             */
/* ------------------------------------------------------------------ */

export async function setConversationStatus(conversationId: string, status: ConversationStatus) {
  return prisma.conversation.update({ where: { id: conversationId }, data: { status } });
}

export async function assignConversation(conversationId: string, userId: string | null) {
  return prisma.conversation.update({ where: { id: conversationId }, data: { assignedUserId: userId } });
}

/** Le client peut fermer sa propre conversation. */
export async function closeConversation(conversationId: string, actor: Actor) {
  const c = await getConversationFor(conversationId, actor);
  if (!c) throw new ChatError("Conversation introuvable", "NOT_FOUND");
  return setConversationStatus(conversationId, "CLOSED");
}

/* ------------------------------------------------------------------ */
/* Données personnelles                                                */
/* ------------------------------------------------------------------ */

/** Export JSON des conversations d'un utilisateur (notes internes exclues). */
export async function exportConversations(userId: string) {
  const rows = await prisma.conversation.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: { messages: { orderBy: { createdAt: "asc" }, select: messageSelect } } });
  return rows.map((c) => ({
    id: c.id,
    subject: c.subject,
    status: c.status,
    email: c.email,
    name: c.name,
    createdAt: c.createdAt,
    messages: c.messages.filter((m) => !isInternal(m)).map((m) => ({ author: m.author, body: m.body, createdAt: m.createdAt })),
  }));
}

/**
 * Purge : supprime les conversations fermées depuis plus de `days` jours (messages en cascade) et
 * ferme puis supprime celles inactives depuis plus de `inactiveDays` jours.
 */
export async function purgeConversations(opts: { days: number; inactiveDays?: number; dryRun?: boolean; now?: Date }) {
  const now = opts.now ?? new Date();
  const closedBefore = new Date(now.getTime() - opts.days * 86_400_000);
  const inactiveBefore = new Date(now.getTime() - (opts.inactiveDays ?? opts.days * 4) * 86_400_000);
  const where: Prisma.ConversationWhereInput = { OR: [{ status: "CLOSED", updatedAt: { lt: closedBefore } }, { lastMessageAt: { lt: inactiveBefore } }] };
  const count = await prisma.conversation.count({ where });
  if (!opts.dryRun && count) await prisma.conversation.deleteMany({ where });
  return count;
}
