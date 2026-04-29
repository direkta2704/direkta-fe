import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const property = await prisma.property.findFirst({
      where: { id, userId: user.id },
      include: {
        energyCert: true,
        media: { orderBy: { ordering: "asc" } },
        listings: { orderBy: { createdAt: "desc" } },
        parent: { select: { id: true, street: true, houseNumber: true, city: true } },
        units: {
          orderBy: { unitLabel: "asc" },
          include: {
            media: { orderBy: { ordering: "asc" } },
            listings: { select: { id: true, status: true, slug: true }, take: 1 },
            energyCert: { select: { id: true } },
          },
        },
      },
    });

    if (!property) {
      return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(property);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.property.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });
    }

    const property = await prisma.property.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(property);
  } catch (err) {
    console.error("Update property error:", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const existing = await prisma.property.findFirst({
      where: { id, userId: user.id },
      include: { units: { select: { id: true } } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Immobilie nicht gefunden" }, { status: 404 });
    }

    const propertyIds = [id, ...existing.units.map((u) => u.id)];

    const listings = await prisma.listing.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const listingIds = listings.map((l) => l.id);

    await prisma.$transaction([
      prisma.viewing.deleteMany({ where: { listingId: { in: listingIds } } }),
      prisma.offer.deleteMany({ where: { listingId: { in: listingIds } } }),
      prisma.lead.deleteMany({ where: { listingId: { in: listingIds } } }),
      prisma.syndicationTarget.deleteMany({ where: { listingId: { in: listingIds } } }),
      prisma.listing.deleteMany({ where: { propertyId: { in: propertyIds } } }),
      prisma.property.deleteMany({ where: { id: { in: propertyIds } } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete property error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
