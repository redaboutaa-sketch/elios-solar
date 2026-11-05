import type { NextConfig } from "next";
import { legacyProductRedirects } from "./src/server/catalog/legacy-slugs";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  poweredByHeader: false,
  reactStrictMode: true,
  // Téléversement de médias (8 Mo max. + marge multipart) via server action.
  experimental: { serverActions: { bodySizeLimit: "9mb" } },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [60, 75, 90],
  },
  // anciennes fiches et anciens configurateurs (références fournisseur) → noms commerciaux HELIOSTORES (308)
  async redirects() {
    return legacyProductRedirects();
  },
  // X-Robots-Tag : posé à l'exécution par src/proxy.ts (headers() est figé au build, pour tous les environnements)
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        source: "/:path*",
        headers: common,
      },
    ];
  },
};

export default nextConfig;
