import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const offer = await prisma.offer.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
      include: { listing: true },
    });

    if (!offer) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    if (offer.status !== "SUBMITTED" && offer.status !== "UNDER_REVIEW") {
      return NextResponse.json(
        { error: "Angebot kann nicht mehr angenommen werden" },
        { status: 400 }
      );
    }

    // Accept this offer
    await prisma.offer.update({
      where: { id },
      data: { status: "ACCEPTED" },
    });

    // Reject all other offers for this listing
    await prisma.offer.updateMany({
      where: {
        listingId: offer.listingId,
        id: { not: id },
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
      },
      data: { status: "REJECTED" },
    });

    // Update listing to RESERVED
    await prisma.listing.update({
      where: { id: offer.listingId },
      data: { status: "RESERVED" },
    });

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        listingId: offer.listingId,
        acceptedOfferId: id,
        finalPrice: offer.amount,
      },
    });

    // Log events
    await prisma.listingEvent.create({
      data: {
        listingId: offer.listingId,
        type: "OFFER_ACCEPTED",
        payload: {
          offerId: id,
          transactionId: transaction.id,
          finalPrice: Number(offer.amount),
        },
        actorUserId: user.id,
      },
    });

    return NextResponse.json({
      ok: true,
      transactionId: transaction.id,
      message: "Angebot angenommen. Inserat ist nun reserviert.",
    });
  } catch (err) {
    console.error("Accept offer error:", err);
    return NextResponse.json({ error: "Annahme fehlgeschlagen" }, { status: 500 });
  }
}
