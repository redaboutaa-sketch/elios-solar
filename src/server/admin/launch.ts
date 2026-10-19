import "server-only";
import { prisma } from "@/lib/prisma";
import type { SiteSettings } from "@/generated/prisma/client";

export const REQUIRED_SETTINGS: Array<{ key: keyof SiteSettings; label: string }> = [
  { key: "legalName", label: "Raison sociale" },
  { key: "siret", label: "SIRET" },
  { key: "vatNumber", label: "N° TVA intracommunautaire" },
  { key: "addressLine1", label: "Adresse" },
  { key: "postalCode", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "phone", label: "Téléphone" },
  { key: "contactEmail", label: "E-mail de contact" },
  { key: "domain", label: "Nom de domaine" },
];

export function missingSettings(s: SiteSettings | null): Array<{ key: string; label: string }> {
  return REQUIRED_SETTINGS.filter(({ key }) => {
    const v = s?.[key];
    return v == null || (typeof v === "string" && v.trim() === "");
  }).map(({ key, label }) => ({ key: String(key), label }));
}

export interface LaunchBlocker { area: string; message: string; href: string }

/** Liste calculée des points bloquant une mise en production. */
export async function launchBlockers(): Promise<LaunchBlocker[]> {
  const [settings, pages, demoFamilies] = await Promise.all([
    prisma.siteSettings.findUnique({ where: { id: 1 } }),
    prisma.contentPage.findMany({ where: { status: { not: "PUBLISHED" } }, select: { slug: true, title: true, status: true }, orderBy: { slug: "asc" } }),
    prisma.productFamily.findMany({ where: { dataStatus: "DEMO", status: { not: "ARCHIVED" } }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const out: LaunchBlocker[] = [];
  for (const m of missingSettings(settings)) out.push({ area: "Réglages", message: `${m.label} non renseigné(e)`, href: "/admin/reglages" });
  for (const p of pages) out.push({ area: "Contenus", message: `Page « ${p.title} » non publiée (${p.status})`, href: `/admin/contenus/pages/${p.slug}` });
  for (const f of demoFamilies) out.push({ area: "Catalogue", message: `Famille « ${f.name} » en données de démonstration`, href: `/admin/catalogue/familles/${f.id}` });
  if (process.env.PAYMENT_PROVIDER !== "stripe") out.push({ area: "Paiement", message: "Paiement en mode démonstration (PAYMENT_PROVIDER ≠ stripe)", href: "/admin" });
  return out;
}

/** Variables {{…}} des pages de contenu alimentées par SiteSettings (identiques à la page publique). */
export const CONTENT_SETTING_KEYS = ["legalName", "legalForm", "addressLine1", "postalCode", "city", "siret", "vatNumber", "contactEmail", "phone"] as const;

export function contentVars(s: SiteSettings | null): Record<string, string | null | undefined> {
  return Object.fromEntries(CONTENT_SETTING_KEYS.map((k) => [k, s?.[k] ?? null]));
}
