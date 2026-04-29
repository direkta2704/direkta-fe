import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { sendOfferDecisionEmail } from "@/lib/email";

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

    // Notify accepted buyer
    const acceptedBuyer = await prisma.buyerProfile.findUnique({ where: { id: offer.buyerId } });
    const prop = await prisma.property.findFirst({ where: { id: offer.listing.propertyId } });
    if (acceptedBuyer && prop) {
      const addr = `${prop.street} ${prop.houseNumber}, ${prop.city}`;
      sendOfferDecisionEmail(acceptedBuyer.email, {
        buyerName: acceptedBuyer.name,
        propertyAddress: addr,
        amount: Number(offer.amount).toLocaleString("de-DE"),
        accepted: true,
      }).catch((err) => console.error("Email send failed:", err));

      // Notify rejected buyers
      const rejectedOffers = await prisma.offer.findMany({
        where: { listingId: offer.listingId, id: { not: id }, status: "REJECTED" },
        include: { buyer: true },
      });
      for (const ro of rejectedOffers) {
        sendOfferDecisionEmail(ro.buyer.email, {
          buyerName: ro.buyer.name,
          propertyAddress: addr,
          amount: Number(ro.amount).toLocaleString("de-DE"),
          accepted: false,
        }).catch((err) => console.error("Email send failed:", err));
      }
    }

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
