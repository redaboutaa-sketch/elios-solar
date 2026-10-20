"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { actorOf, back, fields, firstError, zBool, zOpt, zReq, zText } from "@/server/admin/form";

const PATH = "/admin/reglages";
const schema = z.object({
  brandName: zReq(80),
  brandNameProvisional: zBool,
  legalName: zOpt(200),
  legalForm: zOpt(80),
  siret: zOpt(20).refine((v) => v === null || /^\d{14}$/.test(v.replace(/\s/g, "")), "SIRET : 14 chiffres").transform((v) => v?.replace(/\s/g, "") ?? null),
  vatNumber: zOpt(20).refine((v) => v === null || /^[A-Z]{2}[0-9A-Z]{2,13}$/.test(v.replace(/\s/g, "").toUpperCase()), "N° TVA invalide (ex. FR12345678901)").transform((v) => v?.replace(/\s/g, "").toUpperCase() ?? null),
  shareCapital: zOpt(60),
  rcsCity: zOpt(80),
  addressLine1: zOpt(200),
  addressLine2: zOpt(200),
  postalCode: zOpt(10),
  city: zOpt(120),
  countryCode: zReq(2).transform((v) => v.toUpperCase()).refine((v) => /^[A-Z]{2}$/.test(v), "Code pays ISO à 2 lettres"),
  phone: zOpt(30),
  contactEmail: zOpt(200).refine((v) => v === null || z.email().safeParse(v).success, "E-mail de contact invalide"),
  domain: zOpt(200).refine((v) => v === null || /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(v), "Domaine invalide (ex. heliostores.fr, sans https://)"),
  taxRate: z.preprocess((v) => String(v ?? "").replace(",", ".").trim(), z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, "Taux de TVA invalide")).transform((v) => Math.round(Number(v) * 100)),
  indexable: zBool,
  shipmentPolicy: z.enum(["GROUPED", "SEPARATE"]).default("GROUPED"),
  analyticsEnabled: zBool,
  analyticsScriptUrl: zOpt(500).refine((v) => v === null || /^https:\/\/[^\s"'<>]+$/.test(v), "URL https:// attendue"),
  chatEnabled: zBool,
  chatOfflineMessage: zText(500),
});

export async function updateSettingsAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const parsed = schema.safeParse(fields(formData));
  if (!parsed.success) back(PATH, firstError(parsed.error), "err");
  const { taxRate, ...rest } = parsed.data;
  if (rest.analyticsEnabled && !rest.analyticsScriptUrl) back(PATH, "Indiquez l'URL du script de mesure d'audience pour l'activer.", "err");
  const data = { ...rest, defaultTaxRateBps: taxRate };
  const before = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  await prisma.siteSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  await audit({ ...actorOf(session), action: "settings.update", entity: "SiteSettings", entityId: "1", before, after: data });
  invalidateCatalogCache();
  back(PATH, "Réglages enregistrés.");
}
