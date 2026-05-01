import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

// Admin/seller endpoint to verify buyer identity
export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const { buyerId } = await req.json();

    if (!buyerId) {
      return NextResponse.json({ error: "Buyer ID erforderlich" }, { status: 400 });
    }

    // Verify the buyer has an offer on one of the seller's listings
    const offer = await prisma.offer.findFirst({
      where: { buyerId, listing: { property: { userId: user.id } } },
    });

    if (!offer) {
      return NextResponse.json({ error: "Käufer nicht gefunden" }, { status: 404 });
    }

    await prisma.buyerProfile.update({
      where: { id: buyerId },
      data: { idVerifiedAt: new Date() },
    });

    // Recompute offer risk score (verified ID reduces risk)
    const existing = await prisma.offer.findUnique({ where: { id: offer.id } });
    if (existing && existing.scoreRisk != null) {
      const newRisk = Math.min(100, (existing.scoreRisk || 0) + 25);
      const newComposite = Math.round(
        0.3 * (existing.scoreAmount || 0) +
        0.3 * (existing.scoreFinance || 0) +
        0.2 * (existing.scoreTiming || 0) +
        0.2 * newRisk
      );
      await prisma.offer.update({
        where: { id: offer.id },
        data: { scoreRisk: newRisk, scoreComposite: newComposite },
      });
    }

    return NextResponse.json({ ok: true, message: "Käufer-ID verifiziert" });
  } catch (err) {
    console.error("Verify buyer error:", err);
    return NextResponse.json({ error: "Verifizierung fehlgeschlagen" }, { status: 500 });
  }
}
