import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { robotsHeaderFor } from "@/lib/robots-header";

/**
 * En-tête X-Robots-Tag décidé à l'exécution (et non au build, comme le ferait `headers()` de next.config) :
 * une même image sert la préproduction (tout en noindex) et la production (pages privées seulement en noindex).
 * Le noindex ne protège rien : comptes, devis, commandes et administration restent soumis à l'autorisation serveur.
 */
export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  const value = robotsHeaderFor(request.nextUrl.pathname, process.env["SITE_INDEXABLE"] === "true");
  if (value) res.headers.set("X-Robots-Tag", value);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
