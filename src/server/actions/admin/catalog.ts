"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { CompatStatus, DataStatus, FamilyStatus, StockMode } from "@/generated/prisma/enums";
import { actorOf, back, fields, firstError, safeReturn, zBool, zEuros, zInt, zOpt, zOptDate, zOptDateEnd, zOptEuros, zOptInt, zReq, zText } from "@/server/admin/form";

const ROLES = ["ADMIN", "MANAGER"] as const;
const isUniqueError = (e: unknown) => (e as { code?: string } | null)?.code === "P2002";
const slugRe = /^[a-z0-9][a-z0-9-]*$/;
const zSlugOrStar = zReq(80).refine((v) => v === "*" || slugRe.test(v), "Slug invalide");

/* ------------------------------ Familles ------------------------------ */

export async function updateFamilyStatusAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const parsed = z.object({ id: zReq(64), status: z.enum(FamilyStatus), dataStatus: z.enum(DataStatus) }).safeParse(fields(formData));
  if (!parsed.success) back("/admin/catalogue/familles", firstError(parsed.error), "err");
  const { id, status, dataStatus } = parsed.data;
  const before = await prisma.productFamily.findUnique({ where: { id }, select: { status: true, dataStatus: true, slug: true } });
  if (!before) back("/admin/catalogue/familles", "Famille introuvable", "err");
  await prisma.productFamily.update({ where: { id }, data: { status, dataStatus } });
  await audit({ ...actorOf(session), action: "family.status", entity: "ProductFamily", entityId: id, before, after: { status, dataStatus, slug: before.slug } });
  invalidateCatalogCache();
  back("/admin/catalogue/familles", `Famille « ${before.slug} » mise à jour.`);
}

const familySchema = z.object({
  id: zReq(64),
  name: zReq(120),
  shortDescription: zText(500),
  description: zText(20_000),
  seoTitle: zOpt(160),
  seoDescription: zOpt(320),
  included: zText(5000),
  accessoryRails: zOptInt(0, 20),
  lightingIncluded: z.enum(["", "none", "gutter_led", "blade_led"]).transform((v) => (v === "" ? null : v)),
  dividerThresholdMm: zOptInt(500, 20_000),
});

export async function updateFamilyAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const f = fields(formData);
  const path = `/admin/catalogue/familles/${encodeURIComponent(f.id ?? "")}`;
  const parsed = familySchema.safeParse(f);
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const d = parsed.data;
  const all = (k: string) => formData.getAll(k).map((v) => String(v).trim());
  const labels = all("spec_label"), values = all("spec_value"), statuses = all("spec_status");
  const specs: Array<{ label: string; value: string; status: string }> = [];
  for (let i = 0; i < labels.length; i += 1) {
    const label = labels[i] ?? "", value = values[i] ?? "";
    if (!label && !value) continue;
    const status = (statuses[i] ?? "unknown").toLowerCase();
    if (!label || !value) back(path, `Caractéristique ${i + 1} : libellé et valeur obligatoires`, "err");
    if (!["demo", "supplier_verified", "observed", "unknown"].includes(status)) back(path, `Caractéristique ${i + 1} : statut invalide`, "err");
    specs.push({ label: label.slice(0, 120), value: value.slice(0, 300), status });
  }
  const qs = all("faq_q"), as = all("faq_a");
  const faq: Array<{ q: string; a: string }> = [];
  for (let i = 0; i < qs.length; i += 1) {
    const q = qs[i] ?? "", a = as[i] ?? "";
    if (!q && !a) continue;
    if (!q || !a) back(path, `FAQ ${i + 1} : question et réponse obligatoires`, "err");
    faq.push({ q: q.slice(0, 300), a: a.slice(0, 3000) });
  }
  const included = d.included.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 50);
  const before = await prisma.productFamily.findUnique({ where: { id: d.id }, select: { name: true, shortDescription: true, description: true, seoTitle: true, seoDescription: true, specs: true, included: true, faq: true, accessoryRails: true, lightingIncluded: true, dividerThresholdMm: true, nameHistory: true } });
  if (!before) back("/admin/catalogue/familles", "Famille introuvable", "err");
  const { nameHistory, ...beforeData } = before;
  const data = { name: d.name, shortDescription: d.shortDescription, description: d.description, seoTitle: d.seoTitle, seoDescription: d.seoDescription, specs, included, faq, accessoryRails: d.accessoryRails, lightingIncluded: d.lightingIncluded, dividerThresholdMm: d.dividerThresholdMm };
  // nom commercial : l'ancien nom rejoint l'historique ; la référence fournisseur et le slug ne changent pas
  const history = Array.isArray(nameHistory) ? nameHistory : [];
  const renamed = d.name !== before.name ? [...history, { name: before.name, until: new Date().toISOString().slice(0, 10), by: session.user.email, note: "renommage dans l'administration" }] : history;
  await prisma.productFamily.update({ where: { id: d.id }, data: { ...data, nameHistory: renamed as never, commercialEditedAt: new Date() } });
  await audit({ ...actorOf(session), action: "family.update", entity: "ProductFamily", entityId: d.id, before: beforeData, after: data });
  invalidateCatalogCache();
  back(path, "Famille enregistrée.");
}

export async function addFamilyMediaAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const f = fields(formData);
  const path = `/admin/catalogue/familles/${encodeURIComponent(f.familyId ?? "")}`;
  const parsed = z.object({ familyId: zReq(64), mediaId: zReq(64), role: z.enum(["hero", "gallery", "detail", "thumbnail"]), caption: zText(300), sortOrder: zInt(0, 1000) }).safeParse(f);
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const [family, media] = await Promise.all([prisma.productFamily.findUnique({ where: { id: parsed.data.familyId }, select: { id: true } }), prisma.media.findUnique({ where: { id: parsed.data.mediaId }, select: { id: true } })]);
  if (!family || !media) back(path, "Famille ou média introuvable", "err");
  const pm = await prisma.productMedia.create({ data: parsed.data });
  await audit({ ...actorOf(session), action: "family.media.add", entity: "ProductFamily", entityId: family.id, after: pm });
  invalidateCatalogCache();
  back(path, "Média associé.");
}

export async function removeFamilyMediaAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const pm = await prisma.productMedia.findUnique({ where: { id } });
  if (!pm) back("/admin/catalogue/familles", "Association introuvable", "err");
  await prisma.productMedia.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "family.media.remove", entity: "ProductFamily", entityId: pm.familyId, before: pm });
  invalidateCatalogCache();
  back(`/admin/catalogue/familles/${pm.familyId}`, "Média retiré de la fiche.");
}

export async function addFamilyDocumentAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const f = fields(formData);
  const path = `/admin/catalogue/familles/${encodeURIComponent(f.familyId ?? "")}`;
  const parsed = z.object({ familyId: zReq(64), mediaId: zReq(64), title: zReq(200), kind: z.enum(["notice", "fiche-technique", "garantie", "plan", "autre"]), dataStatus: z.enum(DataStatus) }).safeParse(f);
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const media = await prisma.media.findUnique({ where: { id: parsed.data.mediaId }, select: { id: true } });
  if (!media) back(path, "Média introuvable", "err");
  const doc = await prisma.document.create({ data: parsed.data });
  await audit({ ...actorOf(session), action: "family.document.add", entity: "ProductFamily", entityId: parsed.data.familyId, after: doc });
  invalidateCatalogCache();
  back(path, "Document ajouté.");
}

export async function removeFamilyDocumentAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) back("/admin/catalogue/familles", "Document introuvable", "err");
  await prisma.document.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "family.document.remove", entity: "ProductFamily", entityId: doc.familyId, before: doc });
  invalidateCatalogCache();
  back(doc.familyId ? `/admin/catalogue/familles/${doc.familyId}` : "/admin/catalogue/familles", "Document supprimé.");
}

/* ------------------------------ Variantes ------------------------------ */

const variantSchema = z.object({
  id: zReq(64),
  price: zEuros,
  compareAt: zOptEuros,
  purchasable: zBool,
  stockMode: z.enum(StockMode),
  stockQty: zOptInt(0, 1_000_000),
  leadTimeDays: zOptInt(0, 3650),
  dataStatus: z.enum(DataStatus),
  active: zBool,
});

/** Met à jour une variante. N'affecte jamais les commandes existantes (OrderLine figées). */
export async function updateVariantAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const f = fields(formData);
  const ret = safeReturn(f.returnTo, "/admin/catalogue/variantes");
  const parsed = variantSchema.safeParse(f);
  if (!parsed.success) back(ret, firstError(parsed.error), "err");
  const d = parsed.data;
  if (d.compareAt !== null && d.compareAt <= d.price) back(ret, "Le prix barré doit être supérieur au prix de vente.", "err");
  if (d.stockMode === "STOCK" && d.stockQty === null) back(ret, "Quantité en stock obligatoire en mode « stock ».", "err");
  const before = await prisma.variant.findUnique({ where: { id: d.id }, select: { sku: true, priceCents: true, compareAtCents: true, purchasable: true, stockMode: true, stockQty: true, leadTimeDays: true, dataStatus: true, active: true } });
  if (!before) back(ret, "Variante introuvable", "err");
  const data = { priceCents: d.price, compareAtCents: d.compareAt, purchasable: d.purchasable, stockMode: d.stockMode, stockQty: d.stockQty, leadTimeDays: d.leadTimeDays, dataStatus: d.dataStatus, active: d.active };
  await prisma.variant.update({ where: { id: d.id }, data });
  await audit({ ...actorOf(session), action: before.priceCents !== d.price ? "variant.update.price" : "variant.update", entity: "Variant", entityId: d.id, before, after: { sku: before.sku, ...data } });
  invalidateCatalogCache();
  back(ret, `Variante ${before.sku} enregistrée.`);
}

/* ------------------------- Règles de compatibilité ------------------------- */

const closureSchema = z.object({
  id: zOpt(64),
  closureFamilySlug: zReq(80).refine((v) => slugRe.test(v), "Slug invalide"),
  pergolaFamilySlug: zSlugOrStar,
  segmentLengthMm: zOptInt(100, 20_000),
  pergolaFinishCode: zReq(60),
  mounting: z.enum(["*", "freestanding", "wall"]),
  status: z.enum(CompatStatus),
  reason: zOpt(500),
  dataStatus: z.enum(DataStatus),
});

export async function saveClosureRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/regles";
  const parsed = closureSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  if (id) {
    const before = await prisma.closureCompatRule.findUnique({ where: { id } });
    if (!before) back(path, "Règle introuvable", "err");
    await prisma.closureCompatRule.update({ where: { id }, data });
    await audit({ ...actorOf(session), action: "compat.closure.update", entity: "ClosureCompatRule", entityId: id, before, after: data });
  } else {
    const created = await prisma.closureCompatRule.create({ data });
    await audit({ ...actorOf(session), action: "compat.closure.create", entity: "ClosureCompatRule", entityId: created.id, after: data });
  }
  invalidateCatalogCache();
  back(path, "Règle de fermeture enregistrée.");
}

export async function deleteClosureRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.closureCompatRule.findUnique({ where: { id } });
  if (!before) back("/admin/catalogue/regles", "Règle introuvable", "err");
  await prisma.closureCompatRule.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "compat.closure.delete", entity: "ClosureCompatRule", entityId: id, before });
  invalidateCatalogCache();
  back("/admin/catalogue/regles", "Règle supprimée.");
}

const optionSchema = z.object({
  id: zOpt(64),
  optionFamilySlug: zReq(80).refine((v) => slugRe.test(v), "Slug invalide"),
  pergolaFamilySlug: zSlugOrStar,
  status: z.enum(CompatStatus),
  includedInBase: zBool,
  maxQty: zOptInt(1, 100),
  reason: zOpt(500),
  dataStatus: z.enum(DataStatus),
});

export async function saveOptionRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/regles";
  const parsed = optionSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, ...data } = parsed.data;
  let error: string | null = null;
  try {
    if (id) {
      const before = await prisma.optionCompatRule.findUnique({ where: { id } });
      if (!before) error = "Règle introuvable";
      else {
        await prisma.optionCompatRule.update({ where: { id }, data });
        await audit({ ...actorOf(session), action: "compat.option.update", entity: "OptionCompatRule", entityId: id, before, after: data });
      }
    } else {
      const created = await prisma.optionCompatRule.create({ data });
      await audit({ ...actorOf(session), action: "compat.option.create", entity: "OptionCompatRule", entityId: created.id, after: data });
    }
  } catch (e) {
    if (!isUniqueError(e)) throw e;
    error = "Une règle existe déjà pour ce couple option / pergola.";
  }
  if (error) back(path, error, "err");
  invalidateCatalogCache();
  back(path, "Règle d'option enregistrée.");
}

export async function deleteOptionRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.optionCompatRule.findUnique({ where: { id } });
  if (!before) back("/admin/catalogue/regles", "Règle introuvable", "err");
  await prisma.optionCompatRule.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "compat.option.delete", entity: "OptionCompatRule", entityId: id, before });
  invalidateCatalogCache();
  back("/admin/catalogue/regles", "Règle supprimée.");
}

/* --------------------------- Montage & livraison --------------------------- */

const rateSchema = z.object({ id: zOpt(64), familySlug: zReq(80).refine((v) => slugRe.test(v), "Slug invalide"), dimensionCode: zOpt(40), price: zEuros, dataStatus: z.enum(DataStatus) });

export async function saveInstallationRateAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/tarifs";
  const parsed = rateSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, price, ...rest } = parsed.data;
  const data = { ...rest, priceCents: price };
  if (id) {
    const before = await prisma.installationRate.findUnique({ where: { id } });
    if (!before) back(path, "Tarif introuvable", "err");
    await prisma.installationRate.update({ where: { id }, data });
    await audit({ ...actorOf(session), action: "installation.update", entity: "InstallationRate", entityId: id, before, after: data });
  } else {
    const created = await prisma.installationRate.create({ data });
    await audit({ ...actorOf(session), action: "installation.create", entity: "InstallationRate", entityId: created.id, after: data });
  }
  invalidateCatalogCache();
  back(path, "Tarif de montage enregistré.");
}

export async function deleteInstallationRateAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.installationRate.findUnique({ where: { id } });
  if (!before) back("/admin/catalogue/tarifs", "Tarif introuvable", "err");
  await prisma.installationRate.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "installation.delete", entity: "InstallationRate", entityId: id, before });
  invalidateCatalogCache();
  back("/admin/catalogue/tarifs", "Tarif supprimé.");
}

const shippingSchema = z.object({
  id: zOpt(64),
  countryCode: zReq(2).transform((v) => v.toUpperCase()).refine((v) => /^[A-Z]{2}$/.test(v), "Code pays ISO à 2 lettres"),
  postalPrefixes: zText(2000).transform((v) => v.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean)).refine((a) => a.every((p) => /^[0-9A-Z]{1,5}$/i.test(p)), "Préfixes invalides"),
  price: zEuros,
  label: zReq(120),
  quoteRequired: zBool,
  sortOrder: zInt(0, 1000),
});

export async function saveShippingRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/tarifs";
  const parsed = shippingSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { id, price, ...rest } = parsed.data;
  const data = { ...rest, priceCents: price };
  if (id) {
    const before = await prisma.shippingRule.findUnique({ where: { id } });
    if (!before) back(path, "Règle introuvable", "err");
    await prisma.shippingRule.update({ where: { id }, data });
    await audit({ ...actorOf(session), action: "shipping.update", entity: "ShippingRule", entityId: id, before, after: data });
  } else {
    const created = await prisma.shippingRule.create({ data });
    await audit({ ...actorOf(session), action: "shipping.create", entity: "ShippingRule", entityId: created.id, after: data });
  }
  invalidateCatalogCache();
  back(path, "Règle de livraison enregistrée.");
}

export async function deleteShippingRuleAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.shippingRule.findUnique({ where: { id } });
  if (!before) back("/admin/catalogue/tarifs", "Règle introuvable", "err");
  await prisma.shippingRule.delete({ where: { id } });
  await audit({ ...actorOf(session), action: "shipping.delete", entity: "ShippingRule", entityId: id, before });
  invalidateCatalogCache();
  back("/admin/catalogue/tarifs", "Règle supprimée.");
}

/* ------------------------------ Promotions ------------------------------ */

const promoSchema = z.object({
  code: zOpt(30).transform((v) => (v ? v.toUpperCase() : null)).refine((v) => v === null || /^[A-Z0-9_-]{3,30}$/.test(v), "Code : 3 à 30 caractères A-Z, 0-9, - ou _"),
  label: zReq(120),
  allFamilies: zBool,
  percent: z.preprocess((v) => String(v ?? "").replace(",", ".").trim(), z.string().regex(/^\d{1,2}(\.\d{1,2})?$/, "Pourcentage invalide")).transform((v) => Math.round(Number(v) * 100)).refine((bps) => bps > 0 && bps <= 9000, "Pourcentage entre 0,01 et 90 %"),
  startsAt: zOptDate,
  endsAt: zOptDateEnd,
  active: zBool,
});

export async function createPromotionAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/promotions";
  const parsed = promoSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const { percent, ...d } = parsed.data;
  const familySlugs = formData.getAll("familySlugs").map(String).filter((s) => slugRe.test(s));
  if (!d.allFamilies && familySlugs.length === 0) back(path, "Choisissez au moins une famille ou « toutes les familles ».", "err");
  if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) back(path, "La date de fin doit suivre la date de début.", "err");
  const data = { ...d, percentBps: percent, familySlugs: d.allFamilies ? [] : familySlugs };
  let error: string | null = null;
  try {
    const created = await prisma.promotion.create({ data });
    await audit({ ...actorOf(session), action: "promotion.create", entity: "Promotion", entityId: created.id, after: data });
  } catch (e) {
    if (!isUniqueError(e)) throw e;
    error = "Ce code promotionnel existe déjà.";
  }
  if (error) back(path, error, "err");
  invalidateCatalogCache();
  back(path, "Promotion créée.");
}

export async function togglePromotionAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const id = String(formData.get("id") ?? "");
  const before = await prisma.promotion.findUnique({ where: { id }, select: { active: true, label: true } });
  if (!before) back("/admin/catalogue/promotions", "Promotion introuvable", "err");
  await prisma.promotion.update({ where: { id }, data: { active: !before.active } });
  await audit({ ...actorOf(session), action: before.active ? "promotion.deactivate" : "promotion.activate", entity: "Promotion", entityId: id, before, after: { active: !before.active } });
  invalidateCatalogCache();
  back("/admin/catalogue/promotions", before.active ? "Promotion désactivée." : "Promotion activée.");
}

/* ------------------------------ Sur mesure ------------------------------ */

const customSchema = z.object({
  quoteOnly: zBool,
  widthMinMm: zInt(500, 20_000), widthMaxMm: zInt(500, 20_000), widthStepMm: zInt(1, 1000),
  lengthMinMm: zInt(500, 20_000), lengthMaxMm: zInt(500, 20_000), lengthStepMm: zInt(1, 1000),
  heightMinMm: zInt(500, 10_000), heightMaxMm: zInt(500, 10_000), heightStepMm: zInt(1, 1000),
  dataStatus: z.enum(DataStatus),
}).refine((d) => d.widthMinMm < d.widthMaxMm && d.lengthMinMm < d.lengthMaxMm && d.heightMinMm < d.heightMaxMm, "Chaque minimum doit être inférieur au maximum");

export async function saveCustomSettingsAction(formData: FormData) {
  const { session } = await assertRole([...ROLES]);
  const path = "/admin/catalogue/sur-mesure";
  const parsed = customSchema.safeParse(fields(formData));
  if (!parsed.success) back(path, firstError(parsed.error), "err");
  const before = await prisma.customPergolaSettings.findUnique({ where: { id: 1 } });
  await prisma.customPergolaSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  await audit({ ...actorOf(session), action: "custom.update", entity: "CustomPergolaSettings", entityId: "1", before, after: parsed.data });
  invalidateCatalogCache();
  back(path, "Réglages sur mesure enregistrés.");
}
