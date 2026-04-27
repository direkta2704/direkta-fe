import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { calculateLeadScore } from "@/lib/lead-scoring";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const lead = await prisma.lead.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
      include: {
        listing: { select: { askingPrice: true, property: { select: { street: true, houseNumber: true, city: true } } } },
        viewings: true,
      },
    });

    if (!lead) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const lead = await prisma.lead.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
      include: { listing: { select: { askingPrice: true } } },
    });

    if (!lead) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const askingPrice = lead.listing.askingPrice ? Number(lead.listing.askingPrice) : 0;

    // Recalculate score if qualification data changed
    const newScore = calculateLeadScore({
      financingState: body.financingState ?? lead.financingState,
      timing: body.timing ?? lead.timing,
      budget: body.budget ?? (lead.budget ? Number(lead.budget) : null),
      phone: body.phone ?? lead.phone,
      message: lead.message,
      askingPrice,
    });

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: body.status ?? undefined,
        financingState: body.financingState ?? undefined,
        timing: body.timing ?? undefined,
        budget: body.budget ?? undefined,
        phone: body.phone ?? undefined,
        qualityScore: newScore,
      },
    });

    void user;
    return NextResponse.json(updated);
  } catch (err) {
    console.error("Lead update error:", err);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}
