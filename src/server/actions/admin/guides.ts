"use server";
import { z } from "zod";
import { assertRole } from "@/lib/session";
import { back, fields } from "@/server/admin/form";
import { GuideError, setGuideStatus } from "@/server/guides/status";

/** Statut d'un guide d'installation (validation technique puis publication). Administrateurs seulement. */
export async function setGuideStatusAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN"]);
  const p = z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/), status: z.enum(["DRAFT", "VALIDATED", "PUBLISHED"]), validator: z.string().max(200).optional(), note: z.string().max(2000).optional() }).safeParse(fields(formData));
  if (!p.success) back("/admin/guides", "Requête invalide", "err");
  const path = `/admin/guides/${p.data.slug}`;
  try {
    await setGuideStatus(p.data.slug, p.data.status, { email: session.user.email, validator: p.data.validator, note: p.data.note });
  } catch (e) {
    if (e instanceof GuideError) back(path, e.message, "err");
    throw e;
  }
  back(path, p.data.status === "PUBLISHED" ? "Guide publié." : p.data.status === "VALIDATED" ? "Validation technique enregistrée." : "Guide repassé en brouillon (hors ligne).");
}
