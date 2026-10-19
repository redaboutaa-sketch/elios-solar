import type { Metadata } from "next";
import { ForgotForm } from "@/components/account/auth-forms";
export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };
export default function Page() { return <div className="container-x py-12 max-w-md"><h1 className="font-display text-3xl mb-6">Mot de passe oublié</h1><ForgotForm /></div>; }
