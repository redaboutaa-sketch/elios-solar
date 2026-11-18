import { test, expect, type Page } from "./fixtures";
import { acceptNecessaryOnly } from "./helpers";

/**
 * Bandeau au défilement (demande client du 2026-10-31) : état initial inchangé (logo à gauche) ; une fois la page
 * défilée, logo agrandi et centré sur la largeur du bandeau, sans chevaucher navigation, connexion, panier ni CTA,
 * sans décaler le contenu ; tous les liens restent présents.
 */
const box = (page: Page) => page.evaluate(() => {
  const r = (el: Element) => { const b = el.getBoundingClientRect(); return { l: b.left, r: b.right, w: b.width, h: b.height }; };
  const logo = document.querySelector("[data-header-logo] img")!;
  const bar = document.querySelector(".header-bar > div")!;
  const others = [...bar.querySelectorAll("a, button")].filter((e) => !e.closest("[data-header-logo]") && (e as HTMLElement).offsetParent && e.getBoundingClientRect().width > 0).map(r);
  return { logo: r(logo), others, links: bar.querySelectorAll("a").length, mainTop: document.querySelector("main")!.getBoundingClientRect().top + window.scrollY, vw: window.innerWidth };
});

for (const width of [390, 768, 1440]) {
  test(`logo du bandeau : initial à gauche, agrandi et centré au défilement (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/pergolas");
    await acceptNecessaryOnly(page);
    const header = page.locator("header.site-header");
    await expect(header).not.toHaveAttribute("data-scrolled", /.*/);
    const before = await box(page);
    expect(before.logo.l + before.logo.w / 2).toBeLessThan(before.vw / 2 - 40); // à gauche
    await page.mouse.wheel(0, 600);
    await expect(header).toHaveAttribute("data-scrolled", /.*/);
    await page.waitForTimeout(400); // fin de l'apparition du logo
    const after = await box(page);
    expect(Math.abs(after.logo.l + after.logo.w / 2 - after.vw / 2)).toBeLessThanOrEqual(1); // centré sur le bandeau
    expect(after.logo.h).toBeGreaterThan(before.logo.h); // agrandi
    expect(after.logo.w / after.logo.h).toBeCloseTo(before.logo.w / before.logo.h, 1); // proportions conservées
    for (const o of after.others) expect(o.r <= after.logo.l || o.l >= after.logo.r, `chevauchement ${JSON.stringify(o)}`).toBe(true);
    expect(after.links).toBe(before.links); // aucun lien retiré
    expect(after.mainTop).toBe(before.mainTop); // aucun décalage du contenu
    await page.mouse.wheel(0, -2000);
    await expect(header).not.toHaveAttribute("data-scrolled", /.*/);
  });
}
