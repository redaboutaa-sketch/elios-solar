import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { prisma } from "@/lib/prisma";
import { acceptableAnswer, getAssistant, redactPersonalData } from "@/server/chat/assistant";
import { maybeAutoReply } from "@/server/chat/auto-reply";
import { resetGuideCache } from "@/server/chat/guide";
import { postAdvisorMessage, postCustomerMessage, resetChatRateLimits } from "@/server/chat/service";
import { guest } from "./helpers";

/** Faux fournisseur « chat completions » local : enregistre les requêtes, répond ce que le test demande. */
let server: Server;
let reply: { status: number; content?: string } = { status: 200, content: "" };
const received: string[] = [];
const ENV_KEYS = ["AI_PROVIDER", "AI_API_KEY", "AI_MODEL", "AI_BASE_URL", "AI_DAILY_LIMIT", "ANTHROPIC_API_KEY"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

beforeEach(async () => {
  await prisma.conversation.deleteMany({});
  resetChatRateLimits();
  resetGuideCache();
  received.length = 0;
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      received.push(body);
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content: reply.content } }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
});
afterEach(async () => {
  await new Promise((r) => server.close(r));
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});
afterAll(async () => { await prisma.conversation.deleteMany({}); await prisma.$disconnect(); });

function useFakeProvider(limit = "200") {
  process.env.AI_PROVIDER = "openai_compatible";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "modele-test";
  process.env.AI_BASE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.AI_DAILY_LIMIT = limit;
}

async function ask(body: string, owner = { userId: null, guestKey: guest() }) {
  const { conversation } = await postCustomerMessage({ owner, body: `${body} — écrivez-moi à jean.dupont@example.com ou au 06 12 34 56 78`, email: "jean.dupont@example.com", consentPrivacy: true, offline: true });
  return conversation.id;
}
const last = (id: string) => prisma.chatMessage.findFirst({ where: { conversationId: id, author: "ASSISTANT" }, orderBy: { createdAt: "desc" } });

describe("configuration du fournisseur", () => {
  it("désactivé par défaut ; openai_compatible exige clé, modèle et URL https (ou locale)", () => {
    expect(getAssistant({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getAssistant({ AI_PROVIDER: "openai_compatible", AI_API_KEY: "k", AI_MODEL: "m" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getAssistant({ AI_PROVIDER: "openai_compatible", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "http://exemple.test" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(getAssistant({ AI_PROVIDER: "openai_compatible", AI_API_KEY: "k", AI_MODEL: "m", AI_BASE_URL: "https://api.deepseek.com" } as unknown as NodeJS.ProcessEnv)?.name).toBe("openai_compatible");
    expect(getAssistant({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)?.name).toBe("anthropic");
  });

  it("coordonnées masquées avant envoi ; réponse écartée si montant, référence fournisseur ou ancien nom", () => {
    expect(redactPersonalData("jean.dupont@example.com, 06 12 34 56 78, 12 rue des Lilas")).toBe("[e-mail], [téléphone], [adresse]");
    expect(acceptableAnswer("HelioMax se pose adossée ou autoportante.")).toBe(true);
    expect(acceptableAnswer("Comptez 4 500 € environ.")).toBe(false);
    expect(acceptableAnswer("C'est une SB 450.")).toBe(false);
    expect(acceptableAnswer("La Marbella est très demandée.")).toBe(false);
  });
});

describe("réponse automatique", () => {
  it("sans fournisseur : aide immédiate enregistrée, avec liens", async () => {
    const id = await ask("La HelioMax est-elle autoportante ?");
    expect(await maybeAutoReply(id)).toBe("guide");
    const m = await last(id);
    expect(m?.body).toContain("HelioMax");
    expect((m?.meta as { kind?: string; links?: unknown[] }).kind).toBe("guide");
    expect((m?.meta as { links?: unknown[] }).links?.length).toBeGreaterThan(0);
  });

  it("fournisseur configuré : réponse enregistrée avec le modèle ; aucune coordonnée transmise", async () => {
    useFakeProvider();
    reply = { status: 200, content: "HelioMax se pose autoportante ou adossée." };
    const id = await ask("La HelioMax est-elle autoportante ?");
    expect(await maybeAutoReply(id)).toBe("assistant");
    expect((await last(id))?.body).toBe("HelioMax se pose autoportante ou adossée.");
    expect(received).toHaveLength(1);
    expect(received[0]).not.toContain("jean.dupont@example.com");
    expect(received[0]).not.toMatch(/06 12 34 56 78/);
    expect(received[0]).toContain("[e-mail]");
  });

  it("fournisseur indisponible, réponse non conforme ou plafond atteint : repli sur l'aide immédiate", async () => {
    useFakeProvider();
    reply = { status: 503 };
    let id = await ask("La HelioMax est-elle autoportante ?");
    expect(await maybeAutoReply(id)).toBe("guide");
    reply = { status: 200, content: "Elle coûte 3 990 € posée." };
    id = await ask("Combien coûte la HelioMax ?");
    expect(await maybeAutoReply(id)).toBe("guide");
    expect((await last(id))?.body).not.toContain("€");
    useFakeProvider("0");
    received.length = 0;
    id = await ask("La HelioMax est-elle autoportante ?");
    expect(await maybeAutoReply(id)).toBe("guide");
    expect(received).toHaveLength(0);
  });

  it("aucune réponse automatique après l'intervention d'un conseiller", async () => {
    const owner = { userId: null, guestKey: guest() };
    const id = await ask("Bonjour", owner);
    const admin = await prisma.user.create({ data: { id: `chat-assistant-${guest()}`, name: "Conseiller test", email: `chat-assistant-${guest()}@test.invalid`, role: "ADMIN" } });
    await postAdvisorMessage(id, admin.id, "Bonjour, je regarde votre projet.");
    await postCustomerMessage({ owner, conversationId: id, body: "Merci, et le délai ?", offline: true });
    expect(await maybeAutoReply(id)).toBeNull();
    await prisma.conversation.delete({ where: { id } });
    await prisma.user.delete({ where: { id: admin.id } });
  });
});
