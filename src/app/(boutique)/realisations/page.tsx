import { permanentRedirect } from "next/navigation";

/** Ancienne rubrique : remplacée par la page Références (catégorie « Réalisations clients »). */
export default function Page() {
  permanentRedirect("/references#realisations");
}
