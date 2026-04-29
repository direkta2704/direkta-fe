import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
      include: { energyCert: true },
    });

    if (!property) {
      return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });
    }

    if (!body.type || !body.energyClass || !body.energyValue || !body.primarySource || !body.validUntil) {
      return NextResponse.json({ error: "Alle Pflichtfelder ausfüllen" }, { status: 400 });
    }

    const data = {
      type: body.type as "VERBRAUCH" | "BEDARF",
      energyClass: body.energyClass,
      energyValue: parseFloat(body.energyValue),
      primarySource: body.primarySource,
      validUntil: new Date(body.validUntil),
      pdfAssetId: body.pdfAssetId || null,
    };

    let cert;
    if (property.energyCert) {
      cert = await prisma.energyCertificate.update({
        where: { propertyId: id },
        data,
      });
    } else {
      cert = await prisma.energyCertificate.create({
        data: { ...data, propertyId: id },
      });
    }

    return NextResponse.json(cert, { status: property.energyCert ? 200 : 201 });
  } catch (err) {
    console.error("Energy cert error:", err);
    const message = err instanceof Error ? err.message : "Fehler beim Speichern";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
      include: { energyCert: true },
    });

    if (!property || !property.energyCert) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.energyCertificate.delete({ where: { propertyId: id } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete energy cert error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
