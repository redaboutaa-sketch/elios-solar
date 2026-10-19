import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SignUpForm } from "@/components/account/auth-forms";
export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };
export default async function Page() {
  if (await getSession()) redirect("/compte");
  return <div className="container-x py-12 max-w-md"><h1 className="font-display text-3xl mb-6">Créer un compte</h1><Suspense><SignUpForm /></Suspense></div>;
}
