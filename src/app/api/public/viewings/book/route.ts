import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateICS } from "@/lib/ics";
import { sendViewingConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { viewingId, name, email } = body;

    if (!viewingId || !email || !name) {
      return NextResponse.json({ error: "Name, E-Mail und Termin sind erforderlich" }, { status: 400 });
    }

    const viewing = await prisma.viewing.findFirst({
      where: { id: viewingId, status: "PROPOSED", leadId: null },
      include: {
        listing: {
          select: {
            id: true,
            property: { select: { street: true, houseNumber: true, city: true, postcode: true } },
          },
        },
      },
    });

    if (!viewing) {
      return NextResponse.json({ error: "Termin nicht mehr verfügbar" }, { status: 404 });
    }

    // Find or create lead
    let lead = await prisma.lead.findFirst({
      where: { listingId: viewing.listingId, emailRaw: email.toLowerCase().trim() },
    });

    if (!lead) {
      lead = await prisma.lead.create({
        data: {
          listingId: viewing.listingId,
          emailRaw: email.toLowerCase().trim(),
          name,
          qualityScore: 35,
          status: "VIEWING_SCHEDULED",
          source: "viewing-booking",
        },
      });
    } else {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { status: "VIEWING_SCHEDULED" },
      });
    }

    // Book the slot
    await prisma.viewing.update({
      where: { id: viewingId },
      data: {
        leadId: lead.id,
        status: "CONFIRMED",
      },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: viewing.listingId,
        type: "VIEWING_BOOKED",
        payload: { viewingId, leadId: lead.id, buyerName: name },
      },
    });

    // Generate .ics for buyer
    const p = viewing.listing.property;

    // Notify seller
    const seller = await prisma.user.findFirst({
      where: { properties: { some: { listings: { some: { id: viewing.listingId } } } } },
      select: { email: true },
    });
    const viewDate = viewing.startsAt.toLocaleDateString("de-DE");
    const viewTime = viewing.startsAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    if (seller?.email) {
      sendViewingConfirmationEmail(seller.email, {
        buyerName: name,
        propertyAddress: `${p.street} ${p.houseNumber}, ${p.city}`,
        date: viewDate,
        time: viewTime,
        mode: viewing.mode,
      }).catch((err) => console.error("Email send failed:", err));
    }
    const ics = generateICS({
      title: `Besichtigung: ${p.street} ${p.houseNumber}`,
      description: `Immobilienbesichtigung — ${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
      location: `${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
      startsAt: viewing.startsAt,
      endsAt: viewing.endsAt,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Besichtigung erfolgreich gebucht",
        ics: Buffer.from(ics).toString("base64"),
        viewing: {
          startsAt: viewing.startsAt,
          endsAt: viewing.endsAt,
          location: `${p.street} ${p.houseNumber}, ${p.postcode} ${p.city}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Booking error:", err);
    return NextResponse.json({ error: "Buchung fehlgeschlagen" }, { status: 500 });
  }
}
