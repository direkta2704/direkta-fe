import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function generateSlug(city: string, type: string): string {
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const typeMap: Record<string, string> = {
    ETW: "wohnung",
    EFH: "einfamilienhaus",
    MFH: "mehrfamilienhaus",
    DHH: "doppelhaushaelfte",
    RH: "reihenhaus",
    GRUNDSTUECK: "grundstueck",
  };
  const typeSlug = typeMap[type] || type.toLowerCase();
  const shortId = Math.random().toString(36).slice(2, 6);
  return `${citySlug}/${typeSlug}-${shortId}`;
}

export async function GET() {
  try {
    const user = await getRequiredUser();
    const listings = await prisma.listing.findMany({
      where: { property: { userId: user.id } },
      include: {
        property: {
          select: { id: true, street: true, houseNumber: true, city: true, postcode: true, type: true, livingArea: true, rooms: true },
        },
        media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1 },
        _count: { select: { leads: true, offers: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(listings);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();

    const property = await prisma.property.findFirst({
      where: { id: body.propertyId, userId: user.id },
    });

    if (!property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 });
    }

    const slug = generateSlug(property.city, property.type);

    const listing = await prisma.listing.create({
      data: {
        propertyId: property.id,
        slug,
        titleShort: body.titleShort || null,
        descriptionLong: body.descriptionLong || null,
        askingPrice: body.askingPrice || null,
      },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: listing.id,
        type: "CREATED",
        payload: { source: "form" },
        actorUserId: user.id,
      },
    });

    return NextResponse.json(listing, { status: 201 });
  } catch (err) {
    console.error("Create listing error:", err);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }
}
