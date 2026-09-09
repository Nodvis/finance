import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const candidateEnvPaths = [
  path.join(process.cwd(), ".env"),
  path.join(process.cwd(), "../..", ".env"),
];

for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
    break;
  }
}

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@nodvis/finance-domain", "@nodvis/finance-db"],
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
