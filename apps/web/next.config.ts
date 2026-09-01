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
};

export default withNextIntl(nextConfig);
