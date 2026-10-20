"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { actorOf, back, fields } from "@/server/admin/form";
import { activateSupplierPriceList, rejectSupplierPriceList, rollbackSupplierPrices, SupplierPriceError } from "@/server/supplier-prices/import";

/** Tarifs fournisseur : réservé aux administrateurs (montants internes, nature non établie). */
const PATH = "/admin/catalogue/tarifs-fournisseur";
const idSchema = z.object({ id: z.string().min(1).max(64), returnTo: z.string().max(200).optional() });
const keySchema = z.object({ sourceKey: z.string().min(1).max(120) });

function target(returnTo: string | undefined) {
  return returnTo && /^\/admin\/catalogue\/tarifs-fournisseur(\/[\w-]+)?$/.test(returnTo) ? returnTo : PATH;
}

export async function activateSupplierPriceListAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const p = idSchema.safeParse(fields(formData));
  if (!p.success) back(PATH, "Requête invalide", "err");
  let msg: string;
  try {
    const r = await activateSupplierPriceList(p.data.id, actorOf(session));
    msg = `v${r.list.version} active${r.previous ? ` ; v${r.previous.version} archivée` : ""}. Les montants restent internes.`;
  } catch (e) {
    if (e instanceof SupplierPriceError) back(target(p.data.returnTo), e.message, "err");
    throw e;
  }
  back(target(p.data.returnTo), msg);
}

export async function rollbackSupplierPricesAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const p = keySchema.safeParse(fields(formData));
  if (!p.success) back(PATH, "Requête invalide", "err");
  let msg: string;
  try {
    const r = await rollbackSupplierPrices(p.data.sourceKey, actorOf(session));
    msg = `Retour arrière : v${r.restored.version} réactivée${r.replaced ? `, v${r.replaced.version} archivée` : ""}.`;
  } catch (e) {
    if (e instanceof SupplierPriceError) back(PATH, e.message, "err");
    throw e;
  }
  back(PATH, msg);
}

export async function rejectSupplierPriceListAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const p = idSchema.safeParse(fields(formData));
  if (!p.success) back(PATH, "Requête invalide", "err");
  let msg: string;
  try {
    const r = await rejectSupplierPriceList(p.data.id, actorOf(session));
    msg = `v${r.version} rejetée (conservée pour traçabilité).`;
  } catch (e) {
    if (e instanceof SupplierPriceError) back(target(p.data.returnTo), e.message, "err");
    throw e;
  }
  back(target(p.data.returnTo), msg);
}
