import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();
    const properties = await prisma.property.findMany({
      where: { userId: user.id, parentId: null },
      include: {
        energyCert: true,
        media: { where: { kind: "PHOTO" }, orderBy: { ordering: "asc" }, take: 1 },
        listings: { select: { id: true, status: true, slug: true } },
        units: {
          select: {
            id: true,
            listings: { select: { id: true, status: true }, take: 1 },
          },
        },
        _count: { select: { units: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(properties);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();

    const property = await prisma.property.create({
      data: {
        userId: user.id,
        type: body.type,
        street: body.street,
        houseNumber: body.houseNumber,
        postcode: body.postcode,
        city: body.city,
        lat: body.lat || null,
        lng: body.lng || null,
        livingArea: body.livingArea,
        plotArea: body.plotArea || null,
        yearBuilt: body.yearBuilt || null,
        rooms: body.rooms || null,
        bathrooms: body.bathrooms || null,
        floor: body.floor || null,
        condition: body.condition,
        attributes: body.attributes || null,
        buildingInfo: body.buildingInfo || undefined,
      },
    });

    if (body.energyCert) {
      await prisma.energyCertificate.create({
        data: {
          propertyId: property.id,
          type: body.energyCert.type,
          validUntil: new Date(body.energyCert.validUntil),
          energyClass: body.energyCert.energyClass,
          energyValue: body.energyCert.energyValue,
          primarySource: body.energyCert.primarySource,
        },
      });
    }

    return NextResponse.json(property, { status: 201 });
  } catch (err) {
    console.error("Create property error:", err);
    const message = err instanceof Error ? err.message : "Immobilie konnte nicht erstellt werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
