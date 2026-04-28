import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const listingId = url.searchParams.get("listingId");

  if (!listingId) {
    return NextResponse.json({ error: "listingId erforderlich" }, { status: 400 });
  }

  const slots = await prisma.viewing.findMany({
    where: {
      listingId,
      status: "PROPOSED",
      leadId: null,
      startsAt: { gte: new Date() },
    },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      mode: true,
    },
    orderBy: { startsAt: "asc" },
  });

  return NextResponse.json(slots);
}
