import type { NextConfig } from "next";

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
  async headers() {
    const preprod = process.env.SITE_INDEXABLE !== "true";
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [
      {
        source: "/:path*",
        headers: preprod ? [...common, { key: "X-Robots-Tag", value: "noindex, nofollow" }] : common,
      },
    ];
  },
};

export default nextConfig;
