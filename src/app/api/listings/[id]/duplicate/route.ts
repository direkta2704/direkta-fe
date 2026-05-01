import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const original = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!original) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    const citySlug = original.slug.split("/")[0] || "listing";
    const slug = `${citySlug}/${Math.random().toString(36).slice(2, 8)}`;

    const duplicate = await prisma.listing.create({
      data: {
        propertyId: original.propertyId,
        slug,
        status: "DRAFT",
        titleShort: original.titleShort ? `${original.titleShort} (Kopie)` : null,
        descriptionLong: original.descriptionLong,
        askingPrice: original.askingPrice,
        exposeHeadline: original.exposeHeadline,
        exposeSubheadline: original.exposeSubheadline,
        locationDescription: original.locationDescription,
        buildingDescription: original.buildingDescription,
        highlights: original.highlights ?? undefined,
        sellerContact: original.sellerContact ?? undefined,
      },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: duplicate.id,
        type: "CREATED",
        payload: { source: "duplicate", originalId: original.id },
        actorUserId: user.id,
      },
    });

    return NextResponse.json(duplicate, { status: 201 });
  } catch (err) {
    console.error("Duplicate listing error:", err);
    return NextResponse.json({ error: "Duplizieren fehlgeschlagen" }, { status: 500 });
  }
}
