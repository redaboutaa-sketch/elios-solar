import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetForm } from "@/components/account/auth-forms";
export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };
export default function Page() { return <div className="container-x py-12 max-w-md"><h1 className="font-display text-3xl mb-6">Nouveau mot de passe</h1><Suspense><ResetForm /></Suspense></div>; }
