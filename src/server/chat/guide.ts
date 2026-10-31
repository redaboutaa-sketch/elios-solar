import "server-only";
import { prisma } from "@/lib/prisma";
import { categoryByKey, configuratorHref, productHref, type CategoryKey } from "@/domain/categories";
import { DELIVERY_LEAD_TIME } from "@/domain/delivery";
import { NAME_ALIASES } from "@/domain/nomenclature";
import { guideAnswer, type GuideAnswer, type GuideKnowledge } from "@/domain/chat-guide";
import { loadPublicSystemPrices } from "@/server/pricing/system-prices";
import { mailDeliveryReal } from "@/server/mail/transport";
import { NAME_TRANSCO } from "@/server/catalog/name-transco";
import { postAssistantMessage, postSystemMessage } from "./service";

/**
 * Connaissances de l'aide immédiate, lues dans les données publiées : familles PUBLIÉES ou SUR DEVIS (nom public,
 * description courte), grilles de vente en vigueur (présence seulement, aucun montant), délai publié, contact
 * public. Cache court : une publication de tarif ou un renommage est pris en compte en moins d'une minute.
 */
let cache: { at: number; value: GuideKnowledge } | null = null;
const TTL_MS = 60_000;

export async function guideKnowledge(now = Date.now()): Promise<GuideKnowledge> {
  if (cache && now - cache.at < TTL_MS) return cache.value;
  const [rows, prices, settings] = await Promise.all([
    prisma.productFamily.findMany({ where: { legacy: false, category: { not: null }, status: { in: ["PUBLISHED", "QUOTE_ONLY"] } }, select: { slug: true, name: true, category: true, shortDescription: true, systemRules: true }, orderBy: { sortOrder: "asc" } }),
    loadPublicSystemPrices(),
    prisma.siteSettings.findUnique({ where: { id: 1 }, select: { contactEmail: true } }),
  ]);
  const toConfirm = new Set<string>(NAME_TRANSCO.filter((t) => t.kind === "product" && t.technical === "a_confirmer").map((t) => t.slug));
  const value: GuideKnowledge = {
    families: rows.map((r) => {
      const category = r.category as CategoryKey;
      return {
        slug: r.slug, name: r.name, categoryLabel: categoryByKey(category)?.label ?? "", shortDescription: r.shortDescription,
        href: productHref(category, r.slug), configuratorHref: r.systemRules ? configuratorHref(r.slug) : null,
        priced: prices.tables.has(r.slug), toConfirm: toConfirm.has(r.slug),
      };
    }),
    aliases: NAME_ALIASES.map((a) => ({ alias: a.alias, slug: a.slug })),
    deliveryLeadTime: DELIVERY_LEAD_TIME,
    contactEmail: settings?.contactEmail?.trim() || null,
    mailDelivery: mailDeliveryReal(),
  };
  cache = { at: now, value };
  return value;
}

/** Vide le cache (tests, publication d'un tarif). */
export function resetGuideCache() { cache = null; }

/**
 * Réponse immédiate enregistrée dans la conversation (auteur ASSISTANT, `meta.kind = "guide"`), visible aussitôt par
 * le visiteur et par l'équipe dans l'administration. Une question réservée à un conseiller ajoute la transmission.
 */
export async function postGuideReply(conversationId: string, question: string): Promise<GuideAnswer> {
  const answer = guideAnswer(question, await guideKnowledge());
  await postAssistantMessage(conversationId, answer.text, { kind: "guide", links: answer.links, handover: answer.handover, topic: answer.topic });
  if (answer.topic === "transmission") await postSystemMessage(conversationId, "Demande transmise à l'équipe HELIOSTORES.", { kind: "handover", handover: true });
  return answer;
}
