import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore } from "@/lib/lead-scoring";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { listingId, name, email, phone, message } = body;

    if (!listingId || !email) {
      return NextResponse.json(
        { error: "Inserat-ID und E-Mail sind erforderlich" },
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

    // Deduplicate by email per listing
    const existing = await prisma.lead.findFirst({
      where: { listingId, emailRaw: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Sie haben bereits eine Anfrage für dieses Inserat gesendet" },
        { status: 409 }
      );
    }

    const askingPrice = listing.askingPrice ? Number(listing.askingPrice) : 0;

    const qualityScore = calculateLeadScore({
      financingState: null,
      timing: null,
      budget: null,
      phone: phone || null,
      message: message || null,
      askingPrice,
    });

    const lead = await prisma.lead.create({
      data: {
        listingId,
        emailRaw: email.toLowerCase().trim(),
        name: name || null,
        phone: phone || null,
        message: message || null,
        qualityScore,
        status: "NEW",
        source: "direkta",
      },
    });

    // Log event
    await prisma.listingEvent.create({
      data: {
        listingId,
        type: "LEAD_RECEIVED",
        payload: {
          leadId: lead.id,
          source: "direkta",
          qualityScore,
        },
      },
    });

    return NextResponse.json(
      { ok: true, message: "Ihre Anfrage wurde erfolgreich gesendet" },
      { status: 201 }
    );
  } catch (err) {
    console.error("Enquiry error:", err);
    return NextResponse.json(
      { error: "Anfrage fehlgeschlagen" },
      { status: 500 }
    );
  }
}
