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

    return NextResponse.json(offers);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
