import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE" },
    include: {
      property: {
        select: {
          type: true,
          street: true,
          houseNumber: true,
          postcode: true,
          city: true,
          livingArea: true,
          plotArea: true,
          rooms: true,
          bathrooms: true,
          yearBuilt: true,
          condition: true,
          energyCert: { select: { energyClass: true } },
          media: {
            where: { kind: "PHOTO" },
            orderBy: { ordering: "asc" },
            take: 1,
            select: { storageKey: true },
          },
        },
      },
    },
    orderBy: { publishedAt: "desc" },
  });

  return NextResponse.json(listings);
}
