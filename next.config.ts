import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", ".prisma/client", "adm-zip", "puppeteer", "puppeteer-core", "nodemailer", "stripe", "playwright-core"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "direkta-media-prod.s3.eu-central-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
