import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scoreOffer } from "@/lib/offer-scoring";
import { sendNewOfferEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listingId, name, email, phone, amount, financingState, desiredClosingAt, conditions } = body;

    if (!listingId || !email || !name || !amount) {
      return NextResponse.json(
        { error: "Pflichtfelder: Name, E-Mail und Angebotsbetrag" },
        { status: 400 }
      );
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, status: "ACTIVE" },
    });

    if (!listing) {
      return NextResponse.json(
        { error: "Inserat nicht gefunden oder nicht aktiv" },
        { status: 404 }
      );
    }

    // Find or create buyer profile
    let buyer = await prisma.buyerProfile.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!buyer) {
      buyer = await prisma.buyerProfile.create({
        data: {
          email: email.toLowerCase().trim(),
          name,
          phone: phone || null,
        },
      });
    }

    const askingPrice = listing.askingPrice ? Number(listing.askingPrice) : 0;

    // Score the offer
    const scores = scoreOffer({
      amount: Number(amount),
      askingPrice,
      financingState: financingState || "UNKNOWN",
      desiredClosingAt: desiredClosingAt ? new Date(desiredClosingAt) : null,
      idVerified: false,
      financingProofPresent: false,
      buyerProfileAgeDays: 0,
    });

    const offer = await prisma.offer.create({
      data: {
        listingId,
        buyerId: buyer.id,
        amount: Number(amount),
        financingProofId: null,
        conditions: conditions || null,
        desiredClosingAt: desiredClosingAt ? new Date(desiredClosingAt) : null,
        scoreAmount: scores.scoreAmount,
        scoreFinance: scores.scoreFinance,
        scoreTiming: scores.scoreTiming,
        scoreRisk: scores.scoreRisk,
        scoreComposite: scores.scoreComposite,
        status: "SUBMITTED",
      },
    });

    // Update lead status if exists
    await prisma.lead.updateMany({
      where: { listingId, emailRaw: email.toLowerCase().trim() },
      data: { status: "OFFER_MADE" },
    });

    // Notify seller
    const property = await prisma.property.findFirst({
      where: { id: listing.propertyId },
      include: { user: { select: { email: true } } },
    });
    if (property?.user.email) {
      sendNewOfferEmail(property.user.email, {
        buyerName: name,
        amount: Number(amount).toLocaleString("de-DE"),
        scoreComposite: scores.scoreComposite,
        propertyAddress: `${property.street} ${property.houseNumber}, ${property.city}`,
        listingId,
      }).catch((err) => console.error("Email send failed:", err));
    }

    await prisma.listingEvent.create({
      data: {
        listingId,
        type: "OFFER_RECEIVED",
        payload: {
          offerId: offer.id,
          amount: Number(amount),
          composite: scores.scoreComposite,
        },
      },
    });

    return NextResponse.json(
      { ok: true, message: "Ihr Angebot wurde erfolgreich eingereicht" },
      { status: 201 }
    );
  } catch (err) {
    console.error("Offer submission error:", err);
    return NextResponse.json({ error: "Angebot konnte nicht eingereicht werden" }, { status: 500 });
  }
}
