import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { saveConfiguration } from "@/server/configuration/service";
import { getAssistant } from "@/server/chat/assistant";
import {
  ChatError, advisorsOnline, countUnreadForAdvisors, getConversationFor, linkConfiguration, listMessages, markAdvisorRead,
  postAdvisorMessage, postCustomerMessage, purgeConversations, requestHandover, resetChatRateLimits, touchPresence,
} from "@/server/chat/service";
import { cleanup, guest, standardInput } from "./helpers";

const PREFIX = "chat-test-";
const createdUsers: string[] = [];

async function user(role: "CUSTOMER" | "ADMIN" | "MANAGER" = "CUSTOMER", lastSeenAt: Date | null = null) {
  const id = `${PREFIX}${randomBytes(6).toString("hex")}`;
  createdUsers.push(id);
  return prisma.user.create({ data: { id, name: `Test ${role}`, email: `${id}@test.invalid`, role, lastSeenAt } });
}

async function wipe() {
  await prisma.conversation.deleteMany({});
  await prisma.user.updateMany({ where: { role: { in: ["ADMIN", "MANAGER"] } }, data: { lastSeenAt: null } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await cleanup();
  resetChatRateLimits();
}

beforeEach(async () => {
  await wipe();
  invalidateCatalogCache();
  process.env.ADMIN_NOTIFICATION_EMAIL = "admin@test.invalid";
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, chatEnabled: true }, update: { chatEnabled: true } });
});
afterAll(async () => { await wipe(); await prisma.$disconnect(); });

describe("contrôle d'accès", () => {
  it("un invité ne lit pas la conversation d'un autre invité ; un utilisateur ne lit pas celle d'un autre ; l'admin lit tout", async () => {
    const a = guest();
    const b = guest();
    const { conversation: ca } = await postCustomerMessage({ owner: { guestKey: a }, body: "Bonjour, question A", consentPrivacy: true });
    expect(await getConversationFor(ca.id, { guestKey: a })).not.toBeNull();
    expect(await getConversationFor(ca.id, { guestKey: b })).toBeNull();
    await expect(listMessages(ca.id, { guestKey: b })).rejects.toBeInstanceOf(ChatError);
    // B ne peut pas poster dans la conversation de A
    await expect(postCustomerMessage({ owner: { guestKey: b }, conversationId: ca.id, body: "intrusion" })).rejects.toThrow(/introuvable/);

    const u1 = await user();
    const u2 = await user();
    const { conversation: cu } = await postCustomerMessage({ owner: { userId: u1.id }, body: "Question compte", consentPrivacy: true });
    expect(await getConversationFor(cu.id, { userId: u2.id })).toBeNull();
    // une clé invité ne donne pas accès à une conversation rattachée à un compte
    expect(await getConversationFor(cu.id, { guestKey: a })).toBeNull();

    expect((await listMessages(ca.id, { advisor: true })).map((m) => m.body)).toEqual(["Bonjour, question A"]);
    expect((await listMessages(cu.id, { advisor: true })).length).toBe(1);
  });

  it("les notes internes sont masquées au client", async () => {
    const g = guest();
    const admin = await user("ADMIN");
    const { conversation } = await postCustomerMessage({ owner: { guestKey: g }, body: "Bonjour", consentPrivacy: true });
    await postAdvisorMessage(conversation.id, admin.id, "Client à rappeler (note)", { internal: true });
    await postAdvisorMessage(conversation.id, admin.id, "Bonjour, je regarde.");
    expect((await listMessages(conversation.id, { guestKey: g })).map((m) => m.body)).toEqual(["Bonjour", "Bonjour, je regarde."]);
    expect((await listMessages(conversation.id, { advisor: true })).length).toBe(3);
  });

  it("lier une configuration exige d'en être propriétaire (ou un jeton de partage public)", async () => {
    const g = guest();
    const other = guest();
    const { conversation } = await postCustomerMessage({ owner: { guestKey: g }, body: "Mon projet", consentPrivacy: true });
    const foreign = await saveConfiguration({ input: standardInput(), guestKey: other, title: "Projet d'un autre" });
    await expect(linkConfiguration(conversation.id, { guestKey: g }, { configurationId: foreign.id })).rejects.toThrow(/introuvable/);
    const own = await saveConfiguration({ input: standardInput(), guestKey: g, title: "Mon projet" });
    await linkConfiguration(conversation.id, { guestKey: g }, { configurationId: own.id });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).configurationId).toBe(own.id);
    // jeton de partage public (page /projets/[token]) accepté
    await linkConfiguration(conversation.id, { guestKey: g }, { shareToken: foreign.shareToken });
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: conversation.id } })).configurationId).toBe(foreign.id);
  });
});

describe("validation et limite de fréquence", () => {
  it("refuse au-delà de 10 messages en 5 minutes par propriétaire et au-delà de 2 000 caractères", async () => {
    const g = guest();
    await expect(postCustomerMessage({ owner: { guestKey: g }, body: "x".repeat(2001), consentPrivacy: true })).rejects.toThrow(/trop long/);
    for (let i = 0; i < 10; i++) await postCustomerMessage({ owner: { guestKey: g }, body: `message ${i}`, consentPrivacy: true });
    await expect(postCustomerMessage({ owner: { guestKey: g }, body: "un de trop" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    // un autre propriétaire n'est pas affecté
    await expect(postCustomerMessage({ owner: { guestKey: guest() }, body: "autre", consentPrivacy: true })).resolves.toBeTruthy();
  });

  it("une nouvelle conversation exige le consentement ; le mode hors ligne exige aussi un e-mail", async () => {
    const g = guest();
    await expect(postCustomerMessage({ owner: { guestKey: g }, body: "Bonjour" })).rejects.toThrow(/consentement/);
    await expect(postCustomerMessage({ owner: { guestKey: g }, body: "Bonjour", consentPrivacy: true, offline: true })).rejects.toThrow(/e-mail/);
    await expect(postCustomerMessage({ owner: { guestKey: g }, body: "Bonjour", consentPrivacy: true, offline: true, email: "pas-un-email" })).rejects.toThrow(/invalide/);
    const { conversation } = await postCustomerMessage({ owner: { guestKey: g }, body: "Bonjour", consentPrivacy: true, offline: true, email: "Client@Test.invalid" });
    expect(conversation).toMatchObject({ offline: true, consentPrivacy: true, email: "client@test.invalid" });
    // en direct, l'e-mail reste facultatif
    await expect(postCustomerMessage({ owner: { guestKey: guest() }, body: "Bonjour", consentPrivacy: true })).resolves.toBeTruthy();
  });
});

describe("notifications", () => {
  it("nouveau message client ⇒ un e-mail admin par conversation et par tranche de 10 minutes", async () => {
    const g = guest();
    const t0 = new Date("2026-10-19T10:00:00Z");
    const { conversation } = await postCustomerMessage({ owner: { guestKey: g }, body: "Premier", consentPrivacy: true }, t0);
    await postCustomerMessage({ owner: { guestKey: g }, body: "Deuxième", conversationId: conversation.id }, new Date(t0.getTime() + 60_000));
    let mails = await prisma.emailOutbox.findMany({ where: { template: "chat-admin-notification" } });
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ toEmail: "admin@test.invalid" });
    await postCustomerMessage({ owner: { guestKey: g }, body: "Plus tard", conversationId: conversation.id }, new Date(t0.getTime() + 11 * 60_000));
    mails = await prisma.emailOutbox.findMany({ where: { template: "chat-admin-notification" } });
    expect(mails).toHaveLength(2);
  });

  it("réponse conseiller ⇒ e-mail au client en mode hors ligne ; pas d'e-mail si client actif sans mode hors ligne", async () => {
    const admin = await user("ADMIN");
    const { conversation: off } = await postCustomerMessage({ owner: { guestKey: guest() }, body: "Hors ligne", consentPrivacy: true, offline: true, email: "off@test.invalid" });
    const r1 = await postAdvisorMessage(off.id, admin.id, "Voici notre réponse");
    expect(r1.notified).toBe(true);
    const reply = await prisma.emailOutbox.findFirstOrThrow({ where: { template: "chat-advisor-reply" } });
    expect(reply.toEmail).toBe("off@test.invalid");
    expect((reply.payload as { body: string }).body).toBe("Voici notre réponse");
    expect(r1.conversation.status).toBe("WAITING_CUSTOMER");

    const now = new Date();
    const { conversation: live } = await postCustomerMessage({ owner: { guestKey: guest() }, body: "En direct", consentPrivacy: true, email: "live@test.invalid" }, now);
    const r2 = await postAdvisorMessage(live.id, admin.id, "Réponse immédiate", {}, new Date(now.getTime() + 60_000));
    expect(r2.notified).toBe(false);
    // client inactif depuis plus de 10 min ⇒ e-mail
    const r3 = await postAdvisorMessage(live.id, admin.id, "Toujours là ?", {}, new Date(now.getTime() + 15 * 60_000));
    expect(r3.notified).toBe(true);
    // note interne : jamais d'e-mail
    const r4 = await postAdvisorMessage(off.id, admin.id, "note", { internal: true }, new Date(now.getTime() + 30 * 60_000));
    expect(r4.notified).toBe(false);
  });

  it("compteur de conversations non lues par les conseillers", async () => {
    const admin = await user("ADMIN");
    expect(await countUnreadForAdvisors()).toBe(0);
    const { conversation: c1 } = await postCustomerMessage({ owner: { guestKey: guest() }, body: "A", consentPrivacy: true });
    await postCustomerMessage({ owner: { guestKey: guest() }, body: "B", consentPrivacy: true });
    expect(await countUnreadForAdvisors()).toBe(2);
    await markAdvisorRead(c1.id, new Date(Date.now() + 1000));
    expect(await countUnreadForAdvisors()).toBe(1);
    await postAdvisorMessage(c1.id, admin.id, "Réponse");
    expect(await countUnreadForAdvisors()).toBe(1);
    // transmission demandée : redevient non lue et non assignée
    await requestHandover(c1.id, { advisor: true });
    expect(await countUnreadForAdvisors()).toBe(2);
    expect((await prisma.conversation.findUniqueOrThrow({ where: { id: c1.id } })).assignedUserId).toBeNull();
  });
});

describe("présence et assistant", () => {
  it("aucun conseiller en ligne sans lastSeenAt récent ; en ligne après un signal de présence ; hors ligne si chat désactivé", async () => {
    expect(await advisorsOnline()).toBe(false);
    const old = await user("MANAGER", new Date(Date.now() - 6 * 60_000));
    await user("CUSTOMER", new Date());
    expect(await advisorsOnline()).toBe(false);
    await touchPresence(old.id);
    expect(await advisorsOnline()).toBe(true);
    await prisma.siteSettings.update({ where: { id: 1 }, data: { chatEnabled: false } });
    expect(await advisorsOnline()).toBe(false);
  });

  it("touchPresence n'écrit pas plus d'une fois par minute", async () => {
    const u = await user("ADMIN");
    const t0 = new Date("2026-10-19T10:00:00Z");
    await touchPresence(u.id, t0);
    await touchPresence(u.id, new Date(t0.getTime() + 30_000));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).lastSeenAt?.toISOString()).toBe(t0.toISOString());
    await touchPresence(u.id, new Date(t0.getTime() + 61_000));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).lastSeenAt?.getTime()).toBe(t0.getTime() + 61_000);
  });

  it("assistant null sans fournisseur ni clé", () => {
    expect(getAssistant({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getAssistant({ AI_PROVIDER: "anthropic" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getAssistant({ ANTHROPIC_API_KEY: "sk-test" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    const a = getAssistant({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" } as unknown as NodeJS.ProcessEnv);
    expect(a?.model).toBe("claude-sonnet-5-5");
  });
});

describe("purge", () => {
  it("supprime les conversations fermées depuis plus de N jours", async () => {
    const { conversation: oldClosed } = await postCustomerMessage({ owner: { guestKey: guest() }, body: "ancienne", consentPrivacy: true });
    const { conversation: recent } = await postCustomerMessage({ owner: { guestKey: guest() }, body: "récente", consentPrivacy: true });
    await prisma.conversation.update({ where: { id: oldClosed.id }, data: { status: "CLOSED" } });
    const future = new Date(Date.now() + 200 * 86_400_000);
    expect(await purgeConversations({ days: 180, inactiveDays: 365, dryRun: true, now: future })).toBe(1);
    expect(await purgeConversations({ days: 180, inactiveDays: 365, now: future })).toBe(1);
    expect(await prisma.conversation.findUnique({ where: { id: oldClosed.id } })).toBeNull();
    expect(await prisma.chatMessage.count({ where: { conversationId: oldClosed.id } })).toBe(0);
    expect(await prisma.conversation.findUnique({ where: { id: recent.id } })).not.toBeNull();
  });
});
