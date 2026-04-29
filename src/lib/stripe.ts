import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-04-22.dahlia",
});

const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

export const PRICING = {
  FLAT_FEE: 99900,
  FLAT_FEE_LABEL: "Direkta Flat Fee — Inserat veroeffentlichen",
  SUCCESS_FEE_PERCENT: 0.5,
  SUCCESS_FEE_CAP: 490000,
  SUCCESS_FEE_THRESHOLD: 600000,
};

export async function createCheckoutSession(params: {
  listingId: string;
  userId: string;
  userEmail: string;
  propertyAddress: string;
  pricingModel: "FLAT_FEE" | "SUCCESS_FEE";
  askingPrice?: number;
}): Promise<string> {
  const lineItems: { price_data: { currency: string; product_data: { name: string; description: string }; unit_amount: number }; quantity: number }[] = [];

  if (params.pricingModel === "FLAT_FEE") {
    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "Direkta — Inserat veroeffentlichen",
          description: `Flat-Fee fuer ${params.propertyAddress}`,
        },
        unit_amount: PRICING.FLAT_FEE,
      },
      quantity: 1,
    });
  } else {
    const feeAmount = params.askingPrice
      ? Math.min(Math.round(params.askingPrice * PRICING.SUCCESS_FEE_PERCENT / 100), PRICING.SUCCESS_FEE_CAP)
      : PRICING.SUCCESS_FEE_CAP;

    lineItems.push({
      price_data: {
        currency: "eur",
        product_data: {
          name: "Direkta — Erfolgsprovision",
          description: `${PRICING.SUCCESS_FEE_PERCENT}% Erfolgsprovision fuer ${params.propertyAddress} (max. EUR ${(PRICING.SUCCESS_FEE_CAP / 100).toLocaleString("de-DE")})`,
        },
        unit_amount: feeAmount,
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: params.userEmail,
    payment_method_types: ["card", "sepa_debit"],
    line_items: lineItems,
    success_url: `${APP_URL}/dashboard/listings/${params.listingId}?payment=success`,
    cancel_url: `${APP_URL}/dashboard/listings/${params.listingId}?payment=cancelled`,
    metadata: {
      listingId: params.listingId,
      userId: params.userId,
      pricingModel: params.pricingModel,
    },
  });

  return session.url || "";
}

export async function verifyPayment(listingId: string): Promise<boolean> {
  const sessions = await stripe.checkout.sessions.list({
    limit: 10,
  });

  return sessions.data.some(
    (s) => s.metadata?.listingId === listingId && s.payment_status === "paid"
  );
}
