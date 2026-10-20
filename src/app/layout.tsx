import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";

// Polices du site (choix d'interface) — aucune typographie de marque n'a été fournie par le client.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const indexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
  description: "Pergolas bioclimatiques, screens et stores bannes : choisissez votre modèle, configurez vos dimensions et demandez votre devis.",
  applicationName: BRAND.name,
  openGraph: { siteName: BRAND.name, locale: "fr_FR", type: "website" },
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${outfit.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
