import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();

    const offers = await prisma.offer.findMany({
      where: { listing: { property: { userId: user.id } } },
      include: {
        buyer: true,
        listing: {
          select: {
            id: true,
            slug: true,
            askingPrice: true,
            property: { select: { street: true, houseNumber: true, city: true } },
          },
        },
      },
      orderBy: { scoreComposite: "desc" },
    });

    const listingIds = [...new Set(offers.map((o) => o.listingId))];
    const transactions = await prisma.transaction.findMany({
      where: { listingId: { in: listingIds } },
      select: { id: true, acceptedOfferId: true, listingId: true },
    });
    const txMap = Object.fromEntries(transactions.map((t) => [t.acceptedOfferId, t.id]));

    const result = offers.map((o) => ({
      ...o,
      transactionId: txMap[o.id] || null,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
