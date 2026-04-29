import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const listingId = session.metadata?.listingId;
    const pricingModel = session.metadata?.pricingModel;

    if (listingId && session.payment_status === "paid") {
      await prisma.listing.update({
        where: { id: listingId },
        data: {
          status: "ACTIVE",
          pricingModel: pricingModel === "SUCCESS_FEE" ? "SUCCESS_FEE" : "FLAT_FEE",
          publishedAt: new Date(),
        },
      });

      await prisma.listingEvent.create({
        data: {
          listingId,
          type: "PUBLISHED",
          payload: {
            pricingModel,
            paymentId: session.id,
            amountPaid: session.amount_total,
          },
          actorUserId: session.metadata?.userId,
        },
      });
    }
  }

  return NextResponse.json({ received: true });
}
