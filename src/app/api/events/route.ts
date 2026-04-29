import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequiredUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getRequiredUser();

    const events = await prisma.listingEvent.findMany({
      where: { listing: { property: { userId: user.id } } },
      include: {
        listing: {
          select: {
            id: true,
            slug: true,
            property: { select: { street: true, houseNumber: true, city: true, type: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}
