import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "adm-zip", "puppeteer", "puppeteer-core"],
};

export default nextConfig;
