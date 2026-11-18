import { test, expect, newClientContext } from "./fixtures";
import { acceptNecessaryOnly, shot, uid, loginAdmin } from "./helpers";
import { one } from "./db";


test("chat : un visiteur écrit, un conseiller répond, le visiteur voit la réponse", async ({ page, browser }) => {
  const id = uid();
  const name = `Visiteur ${id}`;
  const question = `Bonjour, la Solis existe-t-elle en 3 x 5 ? (${id})`;
  const answer = `Bonjour, oui : je vous envoie le détail (${id}).`;

  // 1. le visiteur ouvre le widget, consent et envoie un message
  const visitor = await newClientContext(browser, { viewport: page.viewportSize() });
  const vp = await visitor.newPage();
  await vp.goto("/aide");
  await acceptNecessaryOnly(vp);
  await vp.getByRole("button", { name: "Ouvrir l'aide et le chat" }).click();
  const panel = vp.getByRole("dialog", { name: /Discuter avec un conseiller|Aide et demande/ });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Fermer le chat" })).toBeFocused();
  // état de présence honnête : l'un ou l'autre des deux libellés, jamais autre chose
  await expect(panel.getByTestId("chat-status")).toHaveText(/^(Un conseiller est connecté|Aucun conseiller connecté : .+)$/);
  await expect(panel.getByText(/\bIA\b|intelligence artificielle/i)).toHaveCount(0);
  await panel.getByLabel(/^Prénom/).fill(name);
  await panel.getByLabel(/^E-mail/).fill(`chat-${id}@test.invalid`);
  await panel.getByLabel("Votre message").fill(question);
  // sans consentement : refus côté client
  await panel.getByRole("button", { name: "Envoyer" }).click();
  await expect(panel.getByRole("alert")).toContainText("politique de confidentialité");
  await expect(panel.getByRole("link", { name: "politique de confidentialité" })).toHaveAttribute("href", "/confidentialite");
  await panel.getByLabel(/J'accepte que mes messages/).check();
  await panel.getByRole("button", { name: "Envoyer" }).click();
  const thread = panel.getByLabel("Messages", { exact: true });
  await expect(thread.getByText(question)).toBeVisible();
  await expect(panel.getByLabel("Votre message")).toHaveValue("");
  await shot(vp, "chat-widget-ouvert");

  const conv = await one<{ id: string; consentPrivacy: boolean }>('SELECT id, "consentPrivacy" FROM "Conversation" WHERE name = $1', [name]);
  expect(conv?.consentPrivacy).toBe(true);

  // 2. le conseiller voit la conversation et répond
  await loginAdmin(page);
  await page.goto("/admin/conversations");
  const link = page.getByRole("link", { name });
  await expect(link).toBeVisible();
  await shot(page, "admin-conversations");
  await link.click();
  await page.waitForURL(/\/admin\/conversations\/[^/?]+/);
  await expect(page.getByText(question).first()).toBeVisible();
  await page.getByLabel("Réponse").fill(answer);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(/Réponse envoyée/)).toBeVisible();
  const audit = await one<{ action: string }>(`SELECT action FROM "AuditLog" WHERE entity = 'Conversation' AND "entityId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [conv!.id]);
  expect(audit?.action).toBe("conversation.reply");

  // 3. le visiteur voit la réponse par rafraîchissement automatique (polling 6 s)
  await expect(thread.getByText(answer)).toBeVisible({ timeout: 20_000 });
  // un conseiller vient d'être actif : la présence est désormais affichée
  await expect(panel.getByTestId("chat-status")).toHaveText("Un conseiller est connecté", { timeout: 20_000 });
  await shot(vp, "chat-widget-reponse");
  await visitor.close();
});
