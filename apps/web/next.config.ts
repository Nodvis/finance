import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  transpilePackages: ["@nodvis/finance-domain", "@nodvis/finance-db"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default withNextIntl(nextConfig);
