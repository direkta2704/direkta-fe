import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";
import { createCheckoutSession, PRICING } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getRequiredUser();
    const body = await req.json();
    const { listingId } = body;

    if (!listingId) {
      return NextResponse.json({ error: "Listing ID fehlt" }, { status: 400 });
    }

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, property: { userId: user.id } },
      include: {
        property: { select: { street: true, houseNumber: true, city: true } },
      },
    });

    if (!listing) {
      return NextResponse.json({ error: "Inserat nicht gefunden" }, { status: 404 });
    }

    const askingPrice = listing.askingPrice ? Number(listing.askingPrice) * 100 : 0;
    const pricingModel = askingPrice > PRICING.SUCCESS_FEE_THRESHOLD * 100 ? "SUCCESS_FEE" : "FLAT_FEE";

    const p = listing.property;
    const url = await createCheckoutSession({
      listingId,
      userId: user.id,
      userEmail: user.email,
      propertyAddress: `${p.street} ${p.houseNumber}, ${p.city}`,
      pricingModel: pricingModel as "FLAT_FEE" | "SUCCESS_FEE",
      askingPrice: askingPrice,
    });

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout fehlgeschlagen" }, { status: 500 });
  }
}
