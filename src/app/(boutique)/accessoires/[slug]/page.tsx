import { redirect } from "next/navigation";
import { localePath } from "@/i18n/server";

/** Accessoire de l'ancien catalogue de démonstration : non proposé seul dans le catalogue HELIOSTORES. */
export default async function Page() {
  redirect(await localePath("/pergolas"));
}
