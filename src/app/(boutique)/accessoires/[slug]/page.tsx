import { redirect } from "next/navigation";

/** Accessoire de l'ancien catalogue de démonstration : non proposé seul dans le catalogue HELIOSTORES. */
export default function Page() {
  redirect("/pergolas");
}
