import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const parent = await prisma.property.findFirst({
      where: { id, userId: user.id },
    });

    if (!parent) {
      return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });
    }

    const unitLabel = body.unitLabel?.trim();
    if (!unitLabel) {
      return NextResponse.json({ error: "Wohnungsbezeichnung fehlt" }, { status: 400 });
    }
    if (!body.livingArea || body.livingArea <= 0) {
      return NextResponse.json({ error: "Wohnfläche fehlt" }, { status: 400 });
    }

    // Filter room program entries matching this unit's label
    const parentRooms = parent.roomProgram as { name: string; area: number }[] | null;
    let unitRooms: { name: string; area: number }[] | null = null;
    if (parentRooms) {
      const prefix = unitLabel.toLowerCase();
      unitRooms = parentRooms
        .filter((r) => r.name.toLowerCase().startsWith(prefix))
        .map((r) => ({
          name: r.name.replace(new RegExp(`^${unitLabel}\\s*[–—-]\\s*`, "i"), ""),
          area: r.area,
        }));
      if (unitRooms.length === 0) unitRooms = null;
    }

    const unit = await prisma.property.create({
      data: {
        userId: user.id,
        parentId: parent.id,
        unitLabel,
        type: "ETW",
        street: parent.street,
        houseNumber: parent.houseNumber,
        postcode: parent.postcode,
        city: parent.city,
        country: parent.country,
        lat: parent.lat,
        lng: parent.lng,
        livingArea: parseFloat(body.livingArea),
        rooms: body.rooms ? parseFloat(body.rooms) : null,
        bathrooms: body.bathrooms ? parseInt(body.bathrooms) : null,
        floor: body.floor != null ? parseInt(body.floor) : null,
        condition: body.condition || parent.condition,
        attributes: parent.attributes ?? undefined,
        roomProgram: unitRooms ?? undefined,
        specifications: parent.specifications ?? undefined,
        buildingInfo: parent.buildingInfo ?? undefined,
        yearBuilt: parent.yearBuilt,
      },
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (err) {
    console.error("Create unit error:", err);
    const message = err instanceof Error ? err.message : "Fehler beim Erstellen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
