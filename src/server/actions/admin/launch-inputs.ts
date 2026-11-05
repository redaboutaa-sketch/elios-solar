"use server";
import { assertRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { actorOf, back } from "@/server/admin/form";

const STATUSES = ["OPEN", "ANSWERED", "VALIDATED", "WAIVED"] as const;
type Status = (typeof STATUSES)[number];

/** Met à jour un point du registre : statut, réponse ; « Validé » horodate et nomme le validateur. */
export async function updateLaunchInputAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as Status;
  const answerNote = String(formData.get("answerNote") ?? "").trim().slice(0, 2000);
  const path = "/admin/registre";
  if (!STATUSES.includes(status)) back(path, "Statut invalide.", "err");
  const before = await prisma.launchInput.findUnique({ where: { id }, select: { status: true, answerNote: true, validatedAt: true } });
  if (!before) back(path, "Point introuvable.", "err");
  if (status === "VALIDATED" && !answerNote) back(path, "Indiquez la réponse ou la source de la validation.", "err");
  const validated = status === "VALIDATED";
  await prisma.launchInput.update({
    where: { id },
    data: { status, answerNote, validatedAt: validated ? (before.status === "VALIDATED" ? before.validatedAt : new Date()) : null, validatedBy: validated ? session.user.email : null },
  });
  await audit({ ...actorOf(session), action: "launch_input.update", entity: "LaunchInput", entityId: id, before: { status: before.status }, after: { status } });
  back(path, "Registre mis à jour. Appliquez ensuite la donnée validée au catalogue (fiche, règles ou tarifs).");
}
