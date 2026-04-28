import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateExposeContent } from "@/lib/expose-content-ai";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      select: {
        locationDescription: true, buildingDescription: true,
        highlights: true, sellerContact: true,
        exposeHeadline: true, exposeSubheadline: true,
        property: { select: { roomProgram: true, specifications: true, buildingInfo: true } },
      },
    });
    if (!listing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(listing);
  } catch { return NextResponse.json({ error: "Fehler" }, { status: 500 }); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const listing = await prisma.listing.findFirst({ where: { id, property: { userId: user.id } } });
    if (!listing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        locationDescription: body.locationDescription ?? undefined,
        buildingDescription: body.buildingDescription ?? undefined,
        highlights: body.highlights ?? undefined,
        sellerContact: body.sellerContact ?? undefined,
        exposeHeadline: body.exposeHeadline ?? undefined,
        exposeSubheadline: body.exposeSubheadline ?? undefined,
      },
    });

    if (body.roomProgram !== undefined || body.specifications !== undefined || body.buildingInfo !== undefined) {
      await prisma.property.update({
        where: { id: listing.propertyId },
        data: {
          roomProgram: body.roomProgram ?? undefined,
          specifications: body.specifications ?? undefined,
          buildingInfo: body.buildingInfo ?? undefined,
        },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Expose content error:", err);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: { property: { include: { energyCert: true } } },
    });
    if (!listing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const p = listing.property;
    const content = await generateExposeContent({
      type: p.type, street: p.street, houseNumber: p.houseNumber,
      postcode: p.postcode, city: p.city, livingArea: p.livingArea,
      plotArea: p.plotArea, yearBuilt: p.yearBuilt, rooms: p.rooms,
      bathrooms: p.bathrooms, condition: p.condition,
      attributes: p.attributes as string[] | null,
      energyCert: p.energyCert ? {
        type: p.energyCert.type, energyClass: p.energyCert.energyClass,
        energyValue: p.energyCert.energyValue, primarySource: p.energyCert.primarySource,
      } : null,
    });

    await prisma.listing.update({
      where: { id },
      data: {
        exposeHeadline: content.exposeHeadline,
        exposeSubheadline: content.exposeSubheadline,
        locationDescription: content.locationDescription,
        buildingDescription: content.buildingDescription,
        highlights: content.highlights,
      },
    });

    return NextResponse.json(content);
  } catch (err) {
    console.error("Generate expose content error:", err);
    const msg = err instanceof Error ? err.message : "Generierung fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
