"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { ensureGuestKey } from "@/server/guest";
import { CartError, removeLine, setCartDelivery, updateLineQty } from "@/server/cart/service";
import { createOrderFromCart, OrderError } from "@/server/order/service";
import { startPayment } from "@/server/payment";
import { rateLimit } from "@/server/rate-limit";
import { prisma } from "@/lib/prisma";

async function owner() {
  const session = await getSession();
  return { userId: session?.user.id ?? null, guestKey: await ensureGuestKey(), email: session?.user.email ?? null };
}

export async function updateQtyAction(formData: FormData) {
  const o = await owner();
  const lineId = String(formData.get("lineId") ?? "");
  const qty = Number(formData.get("qty") ?? 1);
  try { await updateLineQty(o, lineId, Number.isFinite(qty) ? qty : 1); } catch (e) { if (!(e instanceof CartError)) throw e; }
  redirect("/panier");
}

export async function removeLineAction(formData: FormData) {
  const o = await owner();
  try { await removeLine(o, String(formData.get("lineId") ?? "")); } catch (e) { if (!(e instanceof CartError)) throw e; }
  redirect("/panier");
}

export async function setDeliveryAction(formData: FormData) {
  const o = await owner();
  const postalCode = String(formData.get("postalCode") ?? "").replace(/\D/g, "").slice(0, 5);
  const promo = String(formData.get("promotionCode") ?? "").trim().toUpperCase().slice(0, 30) || null;
  await setCartDelivery(o, { countryCode: "FR", postalCode: postalCode || undefined }, promo);
  redirect("/panier");
}

const address = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80), company: z.string().trim().max(120).optional(),
  line1: z.string().trim().min(3).max(200), line2: z.string().trim().max(200).optional(), postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal à 5 chiffres"), city: z.string().trim().min(1).max(120), countryCode: z.literal("FR"), phone: z.string().trim().min(6).max(30),
});
const checkoutSchema = z.object({ email: z.string().trim().email().max(200), shipping: address, billingSame: z.boolean(), billing: address.optional(), customerNotes: z.string().trim().max(2000).optional(), acceptCgv: z.literal(true, { error: "Vous devez accepter les conditions générales de vente." }), marketingOptIn: z.boolean().optional() });

export type CheckoutState = { error?: string; fieldErrors?: Record<string, string> } | null;

export async function checkoutAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  if (!(await rateLimit("checkout", 20, 600))) return { error: "Trop de tentatives, réessayez plus tard." };
  const o = await owner();
  const get = (k: string) => (formData.get(k) === null ? undefined : String(formData.get(k)));
  const addr = (p: string) => ({ firstName: get(`${p}.firstName`), lastName: get(`${p}.lastName`), company: get(`${p}.company`) || undefined, line1: get(`${p}.line1`), line2: get(`${p}.line2`) || undefined, postalCode: get(`${p}.postalCode`), city: get(`${p}.city`), countryCode: "FR", phone: get(`${p}.phone`) });
  const billingSame = get("billingSame") === "on";
  const parsed = checkoutSchema.safeParse({ email: get("email"), shipping: addr("shipping"), billingSame, billing: billingSame ? undefined : addr("billing"), customerNotes: get("customerNotes") || undefined, acceptCgv: get("acceptCgv") === "on" ? true : false, marketingOptIn: get("marketingOptIn") === "on" });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] = i.message;
    return { error: "Vérifiez les champs signalés.", fieldErrors };
  }
  if (!billingSame && !parsed.data.billing) return { error: "Adresse de facturation incomplète." };
  if (o.userId && parsed.data.marketingOptIn !== undefined) await prisma.user.update({ where: { id: o.userId }, data: { marketingOptIn: parsed.data.marketingOptIn } });
  try {
    const order = await createOrderFromCart({ owner: o, email: parsed.data.email, shippingAddress: parsed.data.shipping, billingAddress: parsed.data.billing, customerNotes: parsed.data.customerNotes });
    const { checkoutUrl } = await startPayment(order.id);
    redirect(checkoutUrl);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    if (e instanceof CartError) return { error: `${e.message} ${e.issues.map((i) => i.message).join(" ")}` };
    throw e;
  }
}
