"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSession, requireUser } from "@/lib/session";
import { getGuestKey } from "@/server/guest";
import { mergeGuestCart } from "@/server/cart/service";
import { claimGuestConfigurations, duplicateConfiguration, setShareRevoked } from "@/server/configuration/service";
import { claimGuestOrders } from "@/server/order/service";
import { enqueueEmail } from "@/server/mail/outbox";
import { audit } from "@/server/audit";
import { headers } from "next/headers";

/** Après connexion : rattache panier, projets et commandes invité au compte. */
export async function afterSignInAction() {
  const session = await getSession();
  const guestKey = await getGuestKey();
  if (!session || !guestKey) return;
  await Promise.all([mergeGuestCart(session.user.id, guestKey), claimGuestConfigurations(session.user.id, guestKey), claimGuestOrders(session.user.id, guestKey)]);
}

export async function duplicateProjectAction(formData: FormData) {
  const session = await requireUser("/compte/projets");
  await duplicateConfiguration(String(formData.get("id")), { userId: session.user.id, guestKey: await getGuestKey() });
  redirect("/compte/projets");
}

export async function toggleShareAction(formData: FormData) {
  const session = await requireUser("/compte/projets");
  await setShareRevoked(String(formData.get("id")), { userId: session.user.id, guestKey: await getGuestKey() }, formData.get("revoke") === "1");
  redirect("/compte/projets");
}

export async function exportDataAction() {
  const session = await requireUser("/compte/donnees");
  const uid = session.user.id;
  const [user, addresses, orders, quotes, configurations, consents] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { name: true, email: true, phone: true, marketingOptIn: true, createdAt: true } }),
    prisma.address.findMany({ where: { userId: uid } }),
    prisma.order.findMany({ where: { userId: uid }, include: { lines: true } }),
    prisma.quote.findMany({ where: { userId: uid } }),
    prisma.configuration.findMany({ where: { ownerUserId: uid }, select: { id: true, title: true, input: true, createdAt: true } }),
    prisma.consent.findMany({ where: { userId: uid } }),
  ]);
  const json = JSON.stringify({ exportedAt: new Date().toISOString(), user, addresses, orders, quotes, configurations, consents }, null, 2);
  await enqueueEmail({ to: session.user.email, subject: "Export de vos données personnelles", template: "account-export", payload: { json } });
  await audit({ actorUserId: uid, action: "account.export", entity: "user", entityId: uid });
  redirect("/compte/donnees?export=1");
}

/**
 * Suppression du compte : les commandes payées sont conservées (obligations comptables,
 * 10 ans) mais anonymisées ; le reste est supprimé.
 */
export async function deleteAccountAction(formData: FormData) {
  const session = await requireUser("/compte/donnees");
  if (String(formData.get("confirm")) !== "SUPPRIMER") redirect("/compte/donnees?erreur=confirmation");
  const uid = session.user.id;
  const anon = `supprime-${uid.slice(0, 8)}@anonymise.invalid`;
  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({ where: { userId: uid }, data: { email: anon, userId: null, shippingAddress: { anonymized: true }, billingAddress: { anonymized: true }, customerNotes: null } });
    await tx.quote.updateMany({ where: { userId: uid }, data: { email: anon, firstName: "Supprimé", lastName: "Supprimé", phone: null, message: null, userId: null } });
    await tx.configuration.deleteMany({ where: { ownerUserId: uid } });
    await tx.cart.deleteMany({ where: { userId: uid } });
    await tx.address.deleteMany({ where: { userId: uid } });
    await tx.consent.deleteMany({ where: { userId: uid } });
    await tx.user.delete({ where: { id: uid } });
  });
  await audit({ actorUserId: null, actorEmail: anon, action: "account.delete", entity: "user", entityId: uid });
  try { await auth.api.signOut({ headers: await headers() }); } catch { /* session déjà invalide */ }
  redirect("/?compte=supprime");
}
