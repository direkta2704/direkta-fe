import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { generateListingTexts } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: {
        property: { include: { energyCert: true } },
      },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Inserat nicht gefunden" },
        { status: 404 }
      );
    }

    const p = listing.property;
    const result = await generateListingTexts({
      type: p.type,
      street: p.street,
      houseNumber: p.houseNumber,
      postcode: p.postcode,
      city: p.city,
      livingArea: p.livingArea,
      plotArea: p.plotArea,
      yearBuilt: p.yearBuilt,
      rooms: p.rooms,
      bathrooms: p.bathrooms,
      floor: p.floor,
      condition: p.condition,
      attributes: p.attributes as string[] | null,
      energyCert: p.energyCert
        ? {
            type: p.energyCert.type,
            energyClass: p.energyCert.energyClass,
            energyValue: p.energyCert.energyValue,
            primarySource: p.energyCert.primarySource,
          }
        : null,
    });

    const updated = await prisma.listing.update({
      where: { id },
      data: {
        descriptionLong: result.descriptionLong,
        titleShort: result.titleShort,
        locationDescription: result.locationDescription || null,
        buildingDescription: result.buildingDescription || null,
        highlights: result.highlights.length > 0 ? result.highlights : undefined,
      },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: id,
        type: "TEXT_GENERATED",
        payload: {
          titleLength: result.titleShort.length,
          descriptionLength: result.descriptionLong.length,
        },
        actorUserId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Generate error:", err);
    const message =
      err instanceof Error ? err.message : "Textgenerierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
