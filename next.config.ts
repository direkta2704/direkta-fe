import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "adm-zip", "puppeteer", "puppeteer-core", "nodemailer", "stripe", "playwright-core"],
};

export default nextConfig;
