import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();

    const viewings = await prisma.viewing.findMany({
      where: { listing: { property: { userId: user.id } } },
      include: {
        listing: {
          select: {
            id: true,
            property: { select: { street: true, houseNumber: true, city: true, postcode: true } },
          },
        },
        lead: { select: { id: true, name: true, emailRaw: true, phone: true, qualityScore: true } },
      },
      orderBy: { startsAt: "asc" },
    });

    return NextResponse.json(viewings);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();

    const { listingId, startsAt, endsAt, mode } = body;

    if (!listingId || !startsAt || !endsAt) {
      return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, property: { userId: user.id } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    const viewing = await prisma.viewing.create({
      data: {
        listingId,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        mode: mode || "ONSITE",
        status: "PROPOSED",
      },
    });

    return NextResponse.json(viewing, { status: 201 });
  } catch (err) {
    console.error("Create viewing error:", err);
    return NextResponse.json({ error: "Erstellen fehlgeschlagen" }, { status: 500 });
  }
}
