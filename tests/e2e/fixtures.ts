import { test as base, expect, type Browser, type BrowserContextOptions } from "@playwright/test";
import { randomInt } from "node:crypto";

/**
 * Chaque parcours agit comme un client distinct : une IP simulée propre (plage de test 198.18.0.0/15,
 * RFC 2544) est transmise en X-Forwarded-For, comme le ferait le proxy frontal. Les quotas par IP
 * (devis, contact, commande, connexion) restent actifs ; ils ne s'accumulent simplement plus d'un
 * parcours à l'autre ni d'une campagne à l'autre. Leur efficacité est vérifiée par 13-anti-force-brute.
 */
export const clientIp = () => `198.${randomInt(18, 20)}.${randomInt(0, 256)}.${randomInt(1, 255)}`;

export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders({ "x-forwarded-for": clientIp() });
    await provide(context);
  },
});

/** Contexte navigateur supplémentaire (autre client : visiteur, client, conseiller) avec sa propre IP. */
export function newClientContext(browser: Browser, opts: BrowserContextOptions = {}) {
  return browser.newContext({ ...opts, extraHTTPHeaders: { ...opts.extraHTTPHeaders, "x-forwarded-for": clientIp() } });
}

export { expect };
export type { Page } from "@playwright/test";
