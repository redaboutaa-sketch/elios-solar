/**
 * Contrôle des médias publics d'un site déployé : chaque galerie produit contient exactement les visuels attendus
 * par le manifeste (src/server/media/heliostores-media.ts) et aucune image n'est cassée.
 *
 *   REVIEW_USER=revue-client REVIEW_PASSWORD="$(sed -n 's/^Mot de passe : //p' /root/elios-solar-revue.txt)" \
 *     pnpm exec tsx scripts/check-public-media.ts https://demo-elios.beaverdata.eu
 *
 * Les identifiants (protection de la préproduction) sont lus dans l'environnement et ne sont jamais affichés.
 * Code de sortie 0 = tout est conforme, 1 = au moins un écart.
 */
import { chromium } from "@playwright/test";
import { HELIOSTORES_MEDIA } from "../src/server/media/heliostores-media";
import { HELIOSTORES_FAMILIES } from "../src/server/catalog/heliostores-data";
import { productHref } from "../src/domain/categories";
import { PUBLIC_FORBIDDEN_NAMES } from "../src/domain/public-sanitize";

const base = (process.argv[2] ?? "http://127.0.0.1:3401").replace(/\/$/, "");
const credentials = process.env.REVIEW_USER && process.env.REVIEW_PASSWORD ? { username: process.env.REVIEW_USER, password: process.env.REVIEW_PASSWORD } : undefined;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ httpCredentials: credentials, viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  let failures = 0;
  const report = (ok: boolean, msg: string) => { console.log(`${ok ? "OK" : "KO"}  ${msg}`); if (!ok) failures += 1; };
  const fetchImage = async (src: string) => {
    const r = await ctx.request.get(new URL(src, base).toString());
    return { status: r.status(), type: r.headers()["content-type"] ?? "", bytes: (await r.body()).length };
  };

  for (const f of HELIOSTORES_FAMILIES.filter((x) => x.category && x.status !== "DRAFT")) {
    const expected = HELIOSTORES_MEDIA.filter((m) => m.familySlug === f.slug);
    await page.goto(base + productHref(f.category!, f.slug), { waitUntil: "load" });
    const gallery = page.getByTestId("system-gallery");
    // la galerie répartit les visuels en modes (« Photos et rendus », « Dessins techniques ») : chaque mode est parcouru
    const modes = gallery.locator("[data-testid=gallery-mode-photos], [data-testid=gallery-mode-technique]");
    const modeCount = await modes.count();
    const alts: string[] = [];
    let count = 0, broken = 0;
    for (let mi = 0; mi < Math.max(1, modeCount); mi += 1) {
      if (modeCount) await modes.nth(mi).click();
      const thumbs = gallery.locator("ul button");
      const n = await thumbs.count();
      const items = Math.max(n, (await gallery.locator("figure img").count()) ? 1 : 0);
      for (let i = 0; i < items; i += 1) {
        if (n) await thumbs.nth(i).click();
        const main = gallery.locator("figure img");
        await main.evaluate((el: HTMLImageElement) => (el.complete ? null : new Promise((res) => { el.onload = el.onerror = () => res(null); })));
        const info = await main.evaluate((el: HTMLImageElement) => ({ src: el.currentSrc || el.src, w: el.naturalWidth, alt: el.alt }));
        const thumbSrc = n ? await thumbs.nth(i).locator("img").getAttribute("src") : null;
        const [a, b] = await Promise.all([fetchImage(info.src), fetchImage(thumbSrc ?? info.src)]);
        const ok = info.w > 0 && a.status === 200 && b.status === 200 && a.type.startsWith("image/") && b.type.startsWith("image/") && a.bytes > 1000;
        if (!ok) { broken += 1; console.log(`    image cassée : « ${info.alt} » (principale ${a.status} ${a.type}, vignette ${b.status} ${b.type}, largeur ${info.w})`); }
        alts.push(info.alt);
        count += 1;
      }
    }
    report(count === expected.length, `${f.slug} : ${count} visuel(s) en galerie (tous modes), ${expected.length} attendu(s)`);
    const missing = expected.filter((m) => !alts.includes(m.alt)).map((m) => m.key);
    report(missing.length === 0, `${f.slug} : visuels du manifeste présents${missing.length ? ` — absents : ${missing.join(", ")}` : ""}`);
    report(broken === 0, `${f.slug} : ${count - broken}/${count} images principales et vignettes chargées et décodées`);
    // aucune référence au fabricant ni au fournisseur (décision du 2026-10-21) : ni crédit, ni nom dans la page
    report((await gallery.getByTestId("media-credit").count()) === 0, `${f.slug} : aucun crédit fabricant affiché`);
    report(!PUBLIC_FORBIDDEN_NAMES.test(await page.content()), `${f.slug} : aucune mention du fabricant, du fournisseur ni de ses références`);
  }

  for (const path of ["/", "/pergolas", "/screens", "/stores-bannes"]) {
    await page.goto(base + path, { waitUntil: "load" });
    await page.evaluate(async () => { for (const img of Array.from(document.querySelectorAll("main img"))) { img.scrollIntoView(); await new Promise((r) => setTimeout(r, 150)); } });
    await page.waitForTimeout(800);
    // images affichées uniquement (un onglet masqué ne charge pas ses images différées : ce n'est pas une image cassée)
    const imgs = await page.$$eval("main img", (els) => els.filter((e) => e.checkVisibility()).map((e) => ({ src: (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src, w: (e as HTMLImageElement).naturalWidth })));
    const bad = imgs.filter((i) => i.w === 0);
    report(imgs.length > 0 && bad.length === 0, `${path} : ${imgs.length} image(s), ${bad.length} cassée(s)`);
  }
  await browser.close();
  console.log(failures ? `\n${failures} écart(s)` : "\nMédias conformes.");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
