import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// F-M3-08: Parse inbound enquiry emails forwarded from portals (IS24, Immowelt)
// Expected format: Postmark inbound webhook (JSON payload)
// Each listing gets a unique inbound address: listing-{shortId}@inbound.direkta.de

interface InboundEmail {
  From: string;
  FromName: string;
  To: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Date: string;
}

function extractIS24Fields(text: string): { name: string | null; email: string | null; phone: string | null; message: string | null } {
  const emailMatch = text.match(/E-Mail:\s*([^\s\n]+@[^\s\n]+)/i) || text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const nameMatch = text.match(/Name:\s*(.+?)(?:\n|$)/i) || text.match(/Von:\s*(.+?)(?:\n|$)/i);
  const phoneMatch = text.match(/Telefon:\s*([+0-9\s()-]+)/i) || text.match(/Tel\.?:\s*([+0-9\s()-]+)/i);
  const messageMatch = text.match(/Nachricht:\s*([\s\S]+?)(?:\n\n|Freundliche|Mit freundlichen|$)/i);

  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    email: emailMatch ? emailMatch[1].trim().toLowerCase() : null,
    phone: phoneMatch ? phoneMatch[1].trim() : null,
    message: messageMatch ? messageMatch[1].trim().slice(0, 2000) : text.slice(0, 500),
  };
}

function extractImmoweltFields(text: string): { name: string | null; email: string | null; phone: string | null; message: string | null } {
  // Immowelt format is similar but slightly different
  return extractIS24Fields(text); // fallback to same parser
}

function extractListingIdFromAddress(toAddress: string): string | null {
  // Format: listing-{id}@inbound.direkta.de or enquiry+{id}@direkta.de
  const match = toAddress.match(/(?:listing-|enquiry\+)([a-z0-9]+)@/i);
  return match ? match[1] : null;
}

export async function POST(req: Request) {
  try {
    const body: InboundEmail = await req.json();

    // Extract listing ID from the To address
    const listingId = extractListingIdFromAddress(body.To);
    if (!listingId) {
      return NextResponse.json({ error: "No listing ID in recipient address" }, { status: 400 });
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId },
      include: { property: { select: { userId: true, street: true, houseNumber: true, city: true } } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Detect portal source from sender/subject
    const fromLower = (body.From + " " + body.Subject).toLowerCase();
    const isIS24 = fromLower.includes("immobilienscout") || fromLower.includes("is24") || fromLower.includes("scout24");
    const isImmowelt = fromLower.includes("immowelt");
    const source = isIS24 ? "IS24" : isImmowelt ? "IMMOWELT" : "EMAIL";

    // Parse the email body
    const text = body.TextBody || body.HtmlBody?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") || "";
    const fields = isIS24 ? extractIS24Fields(text) : isImmowelt ? extractImmoweltFields(text) : extractIS24Fields(text);

    if (!fields.email) {
      // Try to extract from the From header
      fields.email = body.From.toLowerCase();
    }

    if (!fields.name && body.FromName) {
      fields.name = body.FromName;
    }

    // Deduplicate: check if lead with same email already exists for this listing
    const existing = await prisma.lead.findFirst({
      where: {
        listingId,
        emailRaw: fields.email || body.From,
      },
    });

    if (existing) {
      // Update existing lead with portal source if different
      return NextResponse.json({ ok: true, deduplicated: true, leadId: existing.id });
    }

    // Create new lead
    const lead = await prisma.lead.create({
      data: {
        listingId,
        emailRaw: fields.email || body.From,
        name: fields.name,
        phone: fields.phone,
        message: fields.message,
        source,
        status: "NEW",
      },
    });

    // Log event
    await prisma.listingEvent.create({
      data: {
        listingId,
        type: "LEAD_RECEIVED",
        payload: { leadId: lead.id, source, email: fields.email },
      },
    });

    // Send notification to seller
    try {
      const { sendNewLeadEmail } = await import("@/lib/email");
      const seller = await prisma.user.findUnique({ where: { id: listing.property.userId }, select: { email: true } });
      if (seller?.email) {
        await sendNewLeadEmail(seller.email, {
          leadName: fields.name || "Unbekannt",
          leadEmail: fields.email || body.From,
          leadPhone: fields.phone || undefined,
          message: fields.message || undefined,
          qualityScore: 0,
          propertyAddress: `${listing.property.street} ${listing.property.houseNumber}, ${listing.property.city}`,
          listingId,
        });
      }
    } catch (emailErr) {
      console.error("Failed to send lead notification:", emailErr);
    }

    return NextResponse.json({ ok: true, leadId: lead.id, source });
  } catch (err) {
    console.error("Email inbound error:", err);
    return NextResponse.json({ error: "Verarbeitung fehlgeschlagen" }, { status: 500 });
  }
}
