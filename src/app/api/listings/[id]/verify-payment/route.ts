import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { verifyPayment } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getRequiredUser();
    const { id } = await params;
    void req;

    const listing = await prisma.listing.findFirst({
      where: { id, property: { userId: user.id } },
    });

    if (!listing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    // Already active — no need to verify
    if (listing.status === "ACTIVE") {
      return NextResponse.json({ ok: true, status: "ACTIVE" });
    }

    // Check Stripe for completed payment
    const paid = await verifyPayment(id);
    if (!paid) {
      return NextResponse.json({ ok: false, message: "Zahlung nicht gefunden" }, { status: 402 });
    }

    // Activate the listing
    await prisma.listing.update({
      where: { id },
      data: { status: "ACTIVE", publishedAt: new Date() },
    });

    await prisma.listingEvent.create({
      data: {
        listingId: id,
        type: "PUBLISHED",
        payload: { source: "verify-payment-fallback" },
        actorUserId: user.id,
      },
    });

    return NextResponse.json({ ok: true, status: "ACTIVE" });
  } catch (err) {
    console.error("Verify payment error:", err);
    return NextResponse.json({ error: "Verifizierung fehlgeschlagen" }, { status: 500 });
  }
}
