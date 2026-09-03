import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/server/config/i18n.ts");

const config: NextConfig = {
  // Self-contained `node server.js` for the Docker runtime (ADR-0002 / ADR-0011).
  output: "standalone",

  reactStrictMode: true,
  poweredByHeader: false,

  // We host outbound OG images ourselves; remote images are not rendered.
  images: { remotePatterns: [] },

  experimental: {
    // Keep server action inputs small; large payloads are a smell here.
    serverActions: { bodySizeLimit: "1mb" },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Full CSP is added in middleware once asset hosts are known.
        ],
      },
    ];
  },
};

export default withNextIntl(config);
