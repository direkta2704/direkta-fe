import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLeadScore } from "@/lib/lead-scoring";
import { sendNewLeadEmail, sendBuyerEnquiryConfirmation } from "@/lib/email";
import { generateExposePdf } from "@/lib/pdf-generate";

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

    // Notify seller via email
    const property = await prisma.property.findFirst({
      where: { id: listing.propertyId },
      include: { user: { select: { email: true } } },
    });
    if (property?.user.email) {
      sendNewLeadEmail(property.user.email, {
        leadName: name || "Unbekannt",
        leadEmail: email,
        leadPhone: phone,
        message,
        qualityScore,
        propertyAddress: `${property.street} ${property.houseNumber}, ${property.city}`,
        listingId,
      }).catch((err) => console.error("Email send failed:", err));
    }

    // Send expose PDF to buyer (async, don't block response)
    if (property) {
      const addr = `${property.street} ${property.houseNumber}, ${property.city}`;
      const pdfFilename = `Expose_${property.street}_${property.houseNumber}_${property.city}.pdf`.replace(/\s+/g, "_");
      (async () => {
        try {
          const baseUrl = req.headers.get("origin") || `${new URL(req.url).protocol}//${new URL(req.url).host}`;
          const pdfBuffer = await generateExposePdf(`${baseUrl}/expose/${listingId}`);
          await sendBuyerEnquiryConfirmation(email, {
            buyerName: name || "Interessent",
            propertyAddress: addr,
            pdfBuffer,
            pdfFilename,
          });
        } catch (err) {
          console.error("Buyer PDF email failed:", err);
          sendBuyerEnquiryConfirmation(email, {
            buyerName: name || "Interessent",
            propertyAddress: addr,
          }).catch((e) => console.error("Buyer email fallback failed:", e));
        }
      })();
    }

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
