import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    const body = await req.json();

    const offer = await prisma.offer.findFirst({
      where: { id, listing: { property: { userId: user.id } } },
    });

    if (!offer) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.offer.update({
      where: { id },
      data: { status: body.status },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: offer.listingId,
        type: `OFFER_${body.status}`,
        payload: { offerId: id },
        actorUserId: user.id,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Offer update error:", err);
    return NextResponse.json({ error: "Fehlgeschlagen" }, { status: 500 });
  }
}
