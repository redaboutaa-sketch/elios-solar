import type { Metadata, Viewport } from "next";
import { Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/config/brand";

// Polices du site (choix d'interface, licence OFL) — ce ne sont pas les polices du logo ; voir docs/design/direction-artistique.md.
// « optional » plutôt que « swap » : sur réseau lent, une police arrivée après le premier affichage faisait se
// recomposer les paragraphes et décalait la page (CLS 0,09 à 0,18 mesuré le 2026-10-26) ; la police de secours
// ajustée est alors conservée pour cette visite, la police du site s'applique dès qu'elle est en cache.
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "optional" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "optional" });

const indexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.siteUrl),
  title: { default: `${BRAND.name} — ${BRAND.tagline}`, template: `%s — ${BRAND.name}` },
  description: "Pergolas, screens, stores bannes et moustiquaires : choisissez votre modèle, configurez vos dimensions et demandez votre devis.",
  applicationName: BRAND.name,
  openGraph: { siteName: BRAND.name, locale: "fr_FR", type: "website" },
  robots: indexable ? { index: true, follow: true } : { index: false, follow: false, nocache: true },
  // vérification Search Console / Bing Webmaster Tools : jetons fournis par variables d'environnement (vides par défaut)
  ...(indexable && (process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION)
    ? { verification: { ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}), ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}) } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: BRAND.themeColor,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${montserrat.variable} ${inter.variable}`}>
      <body className="min-h-dvh flex flex-col">{children}</body>
    </html>
  );
}
