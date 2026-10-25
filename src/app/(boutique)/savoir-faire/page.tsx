import { permanentRedirect } from "next/navigation";

/** Ancienne rubrique : remplacée par la page Références (catégorie « Production et fabrication »). */
export default function Page() {
  permanentRedirect("/references#production");
}
