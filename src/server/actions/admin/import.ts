"use server";
import { assertRole } from "@/lib/session";
import { audit } from "@/server/audit";
import { invalidateCatalogCache } from "@/server/catalog/load";
import { CatalogImportError, MAX_IMPORT_BYTES, applyImport, createImportPreview } from "@/server/catalog/import";
import { actorOf, back } from "@/server/admin/form";

const PATH = "/admin/import";

export async function previewImportAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(PATH, "Aucun fichier reçu.", "err");
  if (file.size > MAX_IMPORT_BYTES) back(PATH, "Fichier trop volumineux (2 Mo maximum).", "err");
  if (!/\.(csv|json|txt)$/i.test(file.name)) back(PATH, "Extension attendue : .csv ou .json", "err");
  const text = await file.text();
  const record = await createImportPreview(file.name.replace(/[^\w.\- ]/g, "_"), text, session.user.id);
  await audit({ ...actorOf(session), action: "catalog.import.preview", entity: "CatalogImport", entityId: record.id, after: { filename: record.filename } });
  back(`${PATH}?id=${record.id}`, "Aperçu généré : vérifiez les changements avant d'appliquer.");
}

export async function applyImportAction(formData: FormData) {
  const { session } = await assertRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  let message: string;
  let ok = true;
  try {
    const r = await applyImport(id, actorOf(session));
    message = `Import appliqué : ${r.created} création(s), ${r.updated} mise(s) à jour, ${r.priceChanges.length} prix modifié(s).`;
  } catch (e) {
    if (!(e instanceof CatalogImportError)) throw e;
    message = e.message;
    ok = false;
  }
  invalidateCatalogCache();
  back(`${PATH}?id=${encodeURIComponent(id)}`, message, ok ? "ok" : "err");
}
