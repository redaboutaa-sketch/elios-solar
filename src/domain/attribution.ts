/**
 * Attribution d'un prospect (source, campagne, page d'entrée) — pur, partagé client/serveur.
 *
 * Collectée dans le navigateur au premier affichage de la session (sessionStorage, aucun cookie, aucun traceur
 * tiers) et transmise uniquement avec une demande que le visiteur envoie lui-même (devis, contact).
 * Le serveur ne conserve que des champs connus, tronqués : donnée prête pour une future intégration CRM.
 */
export const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"] as const;
export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];

export interface Attribution {
  params: Partial<Record<AttributionKey, string>>;
  /** origine du référent (jamais l'URL complète) */
  referrerHost?: string;
  /** chemin de la page d'entrée, sans paramètres */
  landingPath?: string;
  /** date de première visite de la session (ISO) */
  firstSeenAt?: string;
}

export const ATTRIBUTION_STORAGE_KEY = "hs-attribution";

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);

/** Nettoie une attribution reçue du navigateur : champs connus, longueurs bornées, sinon null. */
export function sanitizeAttribution(raw: unknown): Attribution | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const params: Attribution["params"] = {};
  const p = (r.params ?? {}) as Record<string, unknown>;
  for (const k of ATTRIBUTION_KEYS) {
    const v = clip(p[k], 120);
    if (v) params[k] = v;
  }
  const referrerHost = clip(r.referrerHost, 120)?.replace(/[^a-z0-9.-]/gi, "");
  const landingPath = clip(r.landingPath, 200)?.split("?")[0];
  const firstSeenAt = clip(r.firstSeenAt, 40);
  const out: Attribution = { params };
  if (referrerHost) out.referrerHost = referrerHost;
  if (landingPath && landingPath.startsWith("/")) out.landingPath = landingPath;
  if (firstSeenAt && !Number.isNaN(Date.parse(firstSeenAt))) out.firstSeenAt = new Date(firstSeenAt).toISOString();
  return Object.keys(params).length || out.referrerHost || out.landingPath ? out : null;
}

/** Construit l'attribution de la première page vue (navigateur). */
export function attributionFromLocation(href: string, referrer: string, now = new Date()): Attribution {
  const url = new URL(href);
  const params: Attribution["params"] = {};
  for (const k of ATTRIBUTION_KEYS) {
    const v = url.searchParams.get(k);
    if (v) params[k] = v.slice(0, 120);
  }
  let referrerHost: string | undefined;
  try {
    const r = referrer ? new URL(referrer) : null;
    if (r && r.host !== url.host) referrerHost = r.host;
  } catch {
    referrerHost = undefined;
  }
  return { params, referrerHost, landingPath: url.pathname, firstSeenAt: now.toISOString() };
}
