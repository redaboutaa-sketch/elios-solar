import { describe, expect, it } from "vitest";
import { GUIDE_TOPICS, guideAnswer, matchFamilies, topicAnswer, type GuideKnowledge } from "@/domain/chat-guide";
import { NAME_ALIASES } from "@/domain/nomenclature";
import { PUBLIC_FORBIDDEN_NAMES, PUBLIC_RETIRED_NAMES } from "@/domain/public-sanitize";
import { DELIVERY_LEAD_TIME } from "@/domain/delivery";

const fam = (slug: string, name: string, extra: Partial<GuideKnowledge["families"][number]> = {}) => ({
  slug, name, categoryLabel: "Pergolas", shortDescription: `Description de ${name}.`, href: `/pergolas/${slug}`, configuratorHref: `/configurateur/${slug}`, priced: false, toConfirm: false, ...extra,
});
const K: GuideKnowledge = {
  families: [fam("malaga", "HelioSky"), fam("marbella", "HelioMax"), fam("sevilla", "HelioLux", { toConfirm: true }), fam("casablanca", "HelioSun", { categoryLabel: "Stores bannes", href: "/stores-bannes/casablanca", priced: true })],
  aliases: NAME_ALIASES.map((a) => ({ alias: a.alias, slug: a.slug })),
  deliveryLeadTime: DELIVERY_LEAD_TIME,
  contactEmail: "contact@heliostores.com",
  mailDelivery: false,
};

describe("aide immédiate du chat (réponses déterministes)", () => {
  it("reconnaît un produit par son nom HELIO, son ancien nom ou son slug, sans jamais reprendre l'ancien nom", () => {
    expect(matchFamilies("Bonjour, la heliomax existe en blanc ?", K).map((f) => f.slug)).toEqual(["marbella"]);
    expect(matchFamilies("Votre Marbella est-elle autoportante ?", K).map((f) => f.slug)).toEqual(["marbella"]);
    expect(matchFamilies("store casablanca ou sevilla", K).map((f) => f.slug)).toEqual(["sevilla", "casablanca"]);
    const a = guideAnswer("Votre Marbella est-elle autoportante ?", K);
    expect(a.topic).toBe("produit");
    expect(a.text).toContain("HelioMax");
    expect(a.text).not.toMatch(PUBLIC_RETIRED_NAMES);
    expect(a.links).toEqual([{ href: "/pergolas/marbella", label: "Fiche HelioMax" }, { href: "/configurateur/marbella", label: "Configurer HelioMax" }]);
  });

  it("aucun montant ; statut de prix exact (grille publiée ou devis) ; caractéristiques à confirmer signalées", () => {
    expect(guideAnswer("combien coûte la HelioMax ?", K).text).toMatch(/Prix sur devis[\s\S]*aucun montant/);
    expect(guideAnswer("prix du HelioSun", K).text).toContain("Le configurateur affiche un prix");
    expect(guideAnswer("HelioLux", K).text).toContain("en cours de confirmation");
    const prix = topicAnswer("prix", K);
    expect(prix.text).toContain("(HelioSun)");
    expect(prix.text).not.toMatch(/\d\s?€/);
    expect(topicAnswer("prix", { ...K, families: K.families.map((f) => ({ ...f, priced: false })) }).text).toContain("chaque configuration est chiffrée sur devis");
  });

  it("commande, paiement, garantie : transmis à l'équipe ; question inconnue : aucune réponse inventée ; pas de promesse d'e-mail sans messagerie", () => {
    const c = guideAnswer("Où en est ma commande de HelioMax ?", K);
    expect(c).toMatchObject({ topic: "transmission", handover: true, links: [] });
    expect(c.text).toContain("traités par l'équipe");
    const u = guideAnswer("Faites-vous des vérandas en bois ?", K);
    expect(u).toMatchObject({ topic: "inconnu", handover: true });
    expect(u.text).toContain("Je n'ai pas de réponse validée");
    expect(u.text).not.toMatch(/répond(ra)? par e-mail/);
    expect(guideAnswer("question ?", { ...K, mailDelivery: true }).text).toContain("un conseiller vous répond");
  });

  it("chaque thème répond à partir des informations publiées, sans référence fournisseur", () => {
    for (const t of GUIDE_TOPICS) {
      const a = topicAnswer(t.id, K);
      expect(a.text.length, t.id).toBeGreaterThan(40);
      expect(a.text, t.id).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
      for (const l of a.links) expect(l.href, t.id).toMatch(/^\/[a-z]/);
    }
    expect(topicAnswer("delais", K).text).toContain(DELIVERY_LEAD_TIME);
    expect(guideAnswer("quel délai de livraison ?", K).topic).toBe("delais");
    expect(guideAnswer("peut-on fermer les côtés avec du verre ?", K).topic).toBe("fermetures");
    expect(guideAnswer("comment prendre les mesures ?", K).topic).toBe("mesures");
  });
});
