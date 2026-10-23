"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { actorOf, back, fields } from "@/server/admin/form";
import { rejectSupplierPriceList, SupplierPriceError } from "@/server/supplier-prices/import";

/** Fichiers de tarifs importés : réservé aux administrateurs (montants internes). La publication passe par l'écran Tarifs. */
const PATH = "/admin/catalogue/tarifs-fournisseur";
const idSchema = z.object({ id: z.string().min(1).max(64), returnTo: z.string().max(200).optional() });

function target(returnTo: string | undefined) {
  return returnTo && /^\/admin\/catalogue\/tarifs-fournisseur(\/[\w-]+)?$/.test(returnTo) ? returnTo : PATH;
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
