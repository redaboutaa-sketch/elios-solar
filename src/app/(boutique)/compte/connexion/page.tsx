import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignInForm } from "@/components/account/auth-forms";
export const metadata: Metadata = { title: "Connexion", robots: { index: false } };
export default async function Page(props: PageProps<"/compte/connexion">) {
  const sp = await props.searchParams;
  if (await getSession()) redirect(typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/compte");
  return <div className="container-x py-12 max-w-md"><h1 className="font-display text-3xl mb-6">Connexion</h1>{sp.reset && <p className="mb-4 text-sm text-success">Mot de passe mis à jour, connectez-vous.</p>}<Suspense><SignInForm /></Suspense></div>;
}
