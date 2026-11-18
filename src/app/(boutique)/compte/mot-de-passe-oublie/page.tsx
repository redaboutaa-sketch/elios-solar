import type { Metadata } from "next";
import { ForgotForm } from "@/components/account/auth-forms";
import { mailDeliveryReal } from "@/server/mail/transport";
import { getSiteSettings } from "@/server/catalog/queries";
export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };
export default async function Page() {
  const s = await getSiteSettings();
  return <div className="container-x py-12 max-w-md"><h1 className="font-display text-3xl mb-6">Mot de passe oublié</h1><ForgotForm mailReal={mailDeliveryReal()} contactEmail={s?.contactEmail ?? null} /></div>;
}
