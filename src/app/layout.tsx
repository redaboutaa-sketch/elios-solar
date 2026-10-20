import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const indexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
  description: "Configurez votre pergola bioclimatique, vos fermetures latérales et votre store banne : prix calculé, devis et commande en ligne.",
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
