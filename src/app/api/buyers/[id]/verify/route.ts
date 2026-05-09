import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    // Verify the buyer belongs to an offer on one of the seller's listings
    const buyer = await prisma.buyerProfile.findFirst({
      where: {
        id,
        offers: { some: { listing: { property: { userId: user.id } } } },
      },
    });

    if (!buyer) {
      return NextResponse.json({ error: "Käufer nicht gefunden" }, { status: 404 });
    }

    const updated = await prisma.buyerProfile.update({
      where: { id },
      data: { idVerifiedAt: new Date() },
    });

    return NextResponse.json({ ok: true, idVerifiedAt: updated.idVerifiedAt });
  } catch (err) {
    console.error("Buyer verify error:", err);
    return NextResponse.json({ error: "Verifizierung fehlgeschlagen" }, { status: 500 });
  }
}
