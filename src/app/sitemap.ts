import { prisma } from "@/lib/prisma";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXTAUTH_URL || "https://direkta.de";

  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    select: { slug: true, updatedAt: true },
  });

  const listingUrls = listings.map((l) => ({
    url: `${baseUrl}/immobilien/${l.slug}`,
    lastModified: l.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/immobilien`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...listingUrls,
  ];
}
