import { z } from "zod";

const delivery = z.object({ countryCode: z.string().length(2).default("FR"), postalCode: z.string().trim().max(10).optional() });
const optionChoice = z.object({ familySlug: z.string().min(1).max(60), variantOption: z.string().max(40).optional(), qty: z.number().int().min(1).max(20) });
const mounting = z.enum(["freestanding", "wall"]);

export const pergolaStandardSchema = z.object({
  kind: z.literal("pergola_standard"),
  familySlug: z.string().min(1).max(60),
  mounting,
  dimensionCode: z.string().min(1).max(10),
  finishCode: z.string().min(1).max(40),
  segments: z.record(z.string().regex(/^(front|back|left|right)-\d$/), z.object({ closureFamilySlug: z.string().min(1).max(60), option: z.string().max(40).optional() }).nullable()),
  options: z.array(optionChoice).max(12),
  installation: z.enum(["self", "professional"]),
  delivery,
  promotionCode: z.string().trim().max(30).optional(),
});

export const pergolaCustomSchema = z.object({
  kind: z.literal("pergola_custom"),
  widthMm: z.number().int(),
  lengthMm: z.number().int(),
  heightMm: z.number().int(),
  mounting,
  finishCode: z.string().min(1).max(40),
  sides: z.partialRecord(z.enum(["front", "back", "left", "right"]), z.object({ closureFamilySlug: z.string().max(60) }).nullable()).default({}),
  options: z.array(optionChoice).max(12).default([]),
  installation: z.enum(["self", "professional"]),
  delivery,
  notes: z.string().max(2000).optional(),
});

export const awningSchema = z.object({
  kind: z.literal("awning"),
  familySlug: z.string().min(1).max(60),
  widthMm: z.number().int(),
  projectionMm: z.number().int(),
  cabinetColor: z.string().max(40),
  fabricCode: z.string().max(40),
  bracketMount: z.enum(["wall", "ceiling"]),
  options: z.array(optionChoice).max(5).default([]),
  installation: z.enum(["self", "professional"]),
  delivery,
  promotionCode: z.string().trim().max(30).optional(),
});

export const accessorySchema = z.object({
  kind: z.literal("accessory"),
  familySlug: z.string().min(1).max(60),
  sku: z.string().min(1).max(60),
  qty: z.number().int().min(1).max(20),
  target: z.object({ pergolaFamilySlug: z.string().min(1).max(60), dimensionCode: z.string().max(10).optional(), mounting: mounting.optional(), finishCode: z.string().max(40).optional(), segmentLengthMm: z.number().int().optional() }),
  delivery,
  promotionCode: z.string().trim().max(30).optional(),
});

/** Système à la cote (catalogue HELIOSTORES) : les règles de la famille valident les valeurs côté moteur. */
export const systemSchema = z.object({
  kind: z.literal("system"),
  familySlug: z.string().min(1).max(60),
  widthMm: z.number().int(),
  depthMm: z.number().int().optional(),
  heightMm: z.number().int().optional(),
  mounting: z.enum(["wall", "freestanding", "niche", "facade", "ceiling", "rafter"]),
  finishCode: z.string().min(1).max(40),
  fabricCode: z.string().max(40).optional(),
  controlCode: z.string().max(40).optional(),
  packCode: z.string().max(40).optional(),
  options: z.array(z.object({ code: z.string().min(1).max(40), qty: z.number().int().min(1).max(20).optional(), value: z.string().max(40).optional() })).max(16).default([]),
  sides: z.partialRecord(z.enum(["front", "back", "left", "right"]), z.string().max(60).nullable()).default({}),
  multiModule: z.boolean().optional(),
  installation: z.enum(["self", "professional"]),
  delivery,
  notes: z.string().max(2000).optional(),
});

export const configurationInputSchema = z.discriminatedUnion("kind", [pergolaStandardSchema, pergolaCustomSchema, awningSchema, accessorySchema, systemSchema]);
export type ConfigurationInputParsed = z.infer<typeof configurationInputSchema>;

export const quoteFormSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(30).optional(),
  postalCode: z.string().trim().max(10).optional(),
  message: z.string().trim().max(4000).optional(),
  consent: z.literal(true, { error: "Vous devez accepter le traitement de votre demande." }),
});
