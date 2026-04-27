import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
      include: {
        property: { include: { energyCert: true, media: { orderBy: { ordering: "asc" } } } },
        priceRecommendation: { include: { comparables: true } },
        leads: { orderBy: { qualityScore: "desc" } },
        offers: { orderBy: { scoreComposite: "desc" } },
        events: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    return NextResponse.json(listing);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!existing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const listing = await prisma.listing.update({
      where: { id },
      data: {
        titleShort: body.titleShort ?? existing.titleShort,
        descriptionLong: body.descriptionLong ?? existing.descriptionLong,
        askingPrice: body.askingPrice ?? existing.askingPrice,
        status: body.status ?? existing.status,
        publishedAt: body.status === "ACTIVE" && !existing.publishedAt ? new Date() : existing.publishedAt,
        pausedAt: body.status === "PAUSED" ? new Date() : existing.pausedAt,
        closedAt: body.status === "CLOSED" ? new Date() : existing.closedAt,
      },
    });

    if (body.status && body.status !== existing.status) {
      await prisma.listingEvent.create({
        data: {
          listingId: id,
          type: `STATUS_CHANGED`,
          payload: { from: existing.status, to: body.status },
          actorUserId: user.id,
        },
      });
    }

    return NextResponse.json(listing);
  } catch (err) {
    console.error("Update listing error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
