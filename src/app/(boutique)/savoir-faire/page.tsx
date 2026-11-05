import { notFound, permanentRedirect } from "next/navigation";
import { PUBLIC_SECTIONS } from "@/config/brand";

/** Ancienne rubrique : remplacée par la page Références (catégorie « Production et fabrication »). */
export default function Page() {
  // rubrique Références masquée tant qu'aucun contenu authentique n'est publié : pas de redirection vers une page vide
  if (!PUBLIC_SECTIONS.references) notFound();
  permanentRedirect("/references#production");
}
