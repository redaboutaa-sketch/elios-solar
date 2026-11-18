import { test, expect, newClientContext } from "./fixtures";
import { acceptNecessaryOnly, loginAdmin, uid } from "./helpers";
import { one } from "./db";
import { PUBLIC_FORBIDDEN_NAMES, PUBLIC_RETIRED_NAMES } from "../../src/domain/public-sanitize";

/**
 * Chat sans fournisseur LLM (mode A, configuration de la production au 2026-10-31) : aide immédiate déterministe,
 * collecte de la demande, aucune promesse d'e-mail sans messagerie réelle, conversations séparées entre visiteurs.
 */
test("aide immédiate : thèmes sans enregistrement, réponse utile à un message, demande collectée, conversations séparées", async ({ browser, page }) => {
  const id = uid();
  const visitor = await newClientContext(browser, { viewport: page.viewportSize() });
  const vp = await visitor.newPage();
  await vp.goto("/pergolas");
  await acceptNecessaryOnly(vp);
  await vp.getByRole("button", { name: "Ouvrir l'aide et le chat" }).click();
  const panel = vp.getByRole("dialog", { name: /Discuter avec un conseiller|Aide et demande/ });
  await expect(panel).toBeVisible();
  // statut honnête : sans SMTP, aucune « réponse par e-mail » promise
  await expect(panel.getByTestId("chat-status")).toHaveText(/^(Un conseiller est connecté|Aucun conseiller connecté : votre message est enregistré pour l'équipe|Aucun conseiller connecté : laissez un message, réponse par e-mail)$/);
  await expect(panel.getByText(/\bIA\b|intelligence artificielle/i)).toHaveCount(0);

  // 1. thème proposé : réponse immédiate, sans conversation créée
  const before = await one<{ n: number }>('SELECT count(*)::int AS n FROM "Conversation"');
  await panel.getByRole("button", { name: "Délais de livraison" }).click();
  const quick = panel.getByTestId("chat-guide-answer").last();
  await expect(quick).toContainText("Délai de livraison : entre 4 et 7 semaines");
  await panel.getByRole("button", { name: "Prix et devis" }).click();
  await expect(panel.getByTestId("chat-guide-answer").last()).toContainText("jamais estimé dans ce chat");
  expect((await one<{ n: number }>('SELECT count(*)::int AS n FROM "Conversation"'))!.n).toBe(before!.n);

  // 2. question libre citant un ancien nom : réponse avec le nom HELIO, liens vers la fiche et le configurateur
  const name = `Visiteur aide ${id}`;
  await panel.getByLabel(/^Prénom/).fill(name);
  await panel.getByLabel(/^E-mail/).fill(`aide-${id}@test.invalid`);
  await panel.getByLabel(/J'accepte que mes messages/).check();
  await panel.getByLabel("Votre message").fill(`Bonjour, la Marbella est-elle autoportante ? (${id})`);
  await panel.getByRole("button", { name: "Envoyer" }).click();
  const thread = panel.getByLabel("Messages", { exact: true });
  const reply = thread.getByTestId("chat-guide-answer").last();
  await expect(reply).toContainText("HelioMax");
  await expect(reply.getByRole("link", { name: "Fiche HelioMax" })).toHaveAttribute("href", "/pergolas/marbella");
  await expect(reply.getByRole("link", { name: "Configurer HelioMax" })).toHaveAttribute("href", "/configurateur/marbella");
  const text = await reply.innerText();
  expect(text).not.toMatch(PUBLIC_RETIRED_NAMES);
  expect(text).not.toMatch(PUBLIC_FORBIDDEN_NAMES);
  expect(text).not.toMatch(/\d\s?€/);

  // 3. commande / paiement : jamais traité automatiquement, transmis à l'équipe
  await panel.getByLabel("Votre message").fill(`Où en est ma commande ? (${id})`);
  await panel.getByRole("button", { name: "Envoyer" }).click();
  await expect(thread.getByText("Demande transmise à l'équipe HELIOSTORES.")).toBeVisible();

  // 4. demande collectée et consultable dans l'administration (auteur et nature de chaque message)
  const conv = await one<{ id: string; email: string }>('SELECT id, email FROM "Conversation" WHERE name = $1', [name]);
  expect(conv?.email).toBe(`aide-${id}@test.invalid`);
  const counts = await one<{ customer: number; guide: number }>(`SELECT count(*) FILTER (WHERE author = 'CUSTOMER')::int AS customer, count(*) FILTER (WHERE author = 'ASSISTANT' AND meta->>'kind' = 'guide')::int AS guide FROM "ChatMessage" WHERE "conversationId" = $1`, [conv!.id]);
  expect(counts).toEqual({ customer: 2, guide: 2 });
  await loginAdmin(page);
  await page.goto(`/admin/conversations/${conv!.id}`);
  const adminThread = page.getByRole("list", { name: "Messages" });
  await expect(adminThread.getByText(`Bonjour, la Marbella est-elle autoportante ? (${id})`)).toBeVisible();
  await expect(adminThread.getByText("Aide automatique").first()).toBeVisible();
  await expect(adminThread.getByText(/HelioMax/).first()).toBeVisible();

  // 5. séparation : un autre visiteur ne lit pas cette conversation
  const other = await newClientContext(browser, { viewport: page.viewportSize() });
  const op = await other.newPage();
  const res = await op.request.get(`/api/chat/messages?conversationId=${conv!.id}`);
  expect([403, 404]).toContain(res.status());
  await op.goto("/pergolas");
  await acceptNecessaryOnly(op);
  await op.getByRole("button", { name: "Ouvrir l'aide et le chat" }).click();
  await expect(op.getByRole("dialog").getByText(String(id))).toHaveCount(0);
  await other.close();

  // 6. fermeture au clavier, le focus revient au bouton
  await vp.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(vp.getByRole("button", { name: "Ouvrir l'aide et le chat" })).toBeFocused();
  await visitor.close();
});
